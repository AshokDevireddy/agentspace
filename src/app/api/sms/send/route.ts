/**
 * Send SMS API Route
 * Handles sending outbound SMS messages from agents to clients
 *
 * Reads authentication from httpOnly session cookie.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'
import { sendSMS } from '@/lib/telnyx'
import {
  getDealWithDetails,
  getOrCreateConversation,
  logMessage,
  getAgencyPhoneNumber,
} from '@/lib/sms-helpers'
import { getTierLimits } from '@/lib/subscription-tiers'
import {
  reportMessageUsage,
  getMeteredSubscriptionItems,
} from '@/lib/stripe-usage'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = session.accessToken
    const apiUrl = getApiBaseUrl()

    // Get user details and SMS usage from Django endpoint
    const smsUsageResponse = await fetch(`${apiUrl}/api/user/sms-usage`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (!smsUsageResponse.ok) {
      if (smsUsageResponse.status === 401) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userData = await smsUsageResponse.json()

    // Check subscription message limits
    const subscriptionTier = userData.subscription_tier || 'free'
    const messagesSent = userData.messages_sent_count || 0
    const tierLimits = getTierLimits(subscriptionTier)

    // Block SMS completely for free tier
    if ('smsBlocked' in tierLimits && tierLimits.smsBlocked) {
      return NextResponse.json(
        {
          error: 'SMS not available',
          message:
            'SMS messaging is not available on the Free tier. Please upgrade to Basic or higher to send messages.',
          upgrade_required: true,
        },
        { status: 403 }
      )
    }

    // Check if we need to reset counter based on billing cycle
    const billingCycleEnd = userData.billing_cycle_end
      ? new Date(userData.billing_cycle_end)
      : null
    const now = new Date()
    let shouldResetCounter = false

    // If we have a billing cycle end date and we're past it, we need to fetch fresh billing cycle from Stripe
    if (
      billingCycleEnd &&
      now > billingCycleEnd &&
      userData.stripe_subscription_id
    ) {
      shouldResetCounter = true
      console.log(
        `User ${userData.id} is past billing cycle end (${billingCycleEnd.toISOString()}), counter will be reset`
      )
    }

    // If counter needs reset, do it before checking limits
    let currentMessagesSent = messagesSent
    if (shouldResetCounter) {
      // Reset counter via Django API
      await fetch(`${apiUrl}/api/user/sms-usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'reset' }),
      })
      currentMessagesSent = 0
      console.log(
        `Reset message counter for user ${userData.id} - new billing cycle started`
      )
    }

    // No hard limit anymore - usage-based billing allows unlimited messages
    // But we show a warning when they exceed their included amount
    const isOverLimit = currentMessagesSent >= tierLimits.messages
    const overageCount = isOverLimit
      ? currentMessagesSent - tierLimits.messages + 1
      : 0

    const body = await request.json()
    const { dealId, message } = body

    if (!dealId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: dealId, message' },
        { status: 400 }
      )
    }

    // Get deal details
    const deal = await getDealWithDetails(dealId)

    if (!deal.client_phone) {
      return NextResponse.json(
        { error: 'Client phone number not found in deal' },
        { status: 400 }
      )
    }

    // Get agency phone number
    const agencyPhone = await getAgencyPhoneNumber(userData.agency_id)
    if (!agencyPhone) {
      return NextResponse.json(
        {
          error:
            'Agency phone number not configured. Please configure in Settings.',
        },
        { status: 400 }
      )
    }

    // Get or create conversation (using client phone to prevent duplicates)
    const conversation = await getOrCreateConversation(
      userData.id,
      dealId,
      userData.agency_id,
      deal.client_phone
    )

    // IMPORTANT: Verify that the current user is the agent for this conversation
    // Prevent uplines from sending messages in conversations they don't own
    if (conversation.agent_id !== userData.id) {
      return NextResponse.json(
        {
          error:
            'Unauthorized: You can only send messages in your own conversations',
        },
        { status: 403 }
      )
    }

    // Check opt-out status before sending
    if (conversation.sms_opt_in_status === 'opted_out') {
      return NextResponse.json(
        { error: 'Client has opted out of SMS messages. Cannot send message.' },
        { status: 403 }
      )
    }

    // Note: Pending status still blocks sends, but new conversations are auto-opted-in
    if (conversation.sms_opt_in_status === 'pending') {
      return NextResponse.json(
        {
          error:
            'Cannot send message to this conversation. Contact support if this persists.',
        },
        { status: 403 }
      )
    }

    // Send SMS via Telnyx
    try {
      const telnyxResponse = await sendSMS({
        from: agencyPhone,
        to: deal.client_phone,
        text: message,
      })

      // Log the message
      await logMessage({
        conversationId: conversation.id,
        senderId: userData.id,
        receiverId: userData.id, // Placeholder since client may not have user record
        body: message,
        direction: 'outbound',
        status: 'sent',
        metadata: {
          telnyx_message_id: telnyxResponse.data.id,
          client_phone: deal.client_phone,
          client_name: deal.client_name,
        },
      })

      // Increment messages_sent_count via Django API
      await fetch(`${apiUrl}/api/user/sms-usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'increment' }),
      })

      // If user has exceeded their tier limit, report usage to Stripe for metered billing
      if (isOverLimit && userData.stripe_subscription_id) {
        const { messagesItemId } = await getMeteredSubscriptionItems(
          userData.stripe_subscription_id
        )
        if (messagesItemId) {
          await reportMessageUsage(
            userData.stripe_subscription_id,
            messagesItemId,
            1
          )
          const overagePrice = 'overagePrice' in tierLimits ? tierLimits.overagePrice : 0
          console.log(
            `💰 User ${userData.id} will be charged $${overagePrice} for message overage`
          )
        }
      }

      const overagePriceForResponse = 'overagePrice' in tierLimits ? tierLimits.overagePrice : 0
      return NextResponse.json({
        success: true,
        message: 'SMS sent successfully',
        conversationId: conversation.id,
        overage: isOverLimit
          ? {
              isOverLimit: true,
              overageCount,
              perMessageCost: overagePriceForResponse,
              estimatedCost: overageCount * overagePriceForResponse,
            }
          : undefined,
      })
    } catch (telnyxError: unknown) {
      console.error('Telnyx SMS error:', telnyxError)

      // Check if this is a STOP block error (40300)
      const errorMessage =
        telnyxError instanceof Error ? telnyxError.message : ''
      if (errorMessage && errorMessage.includes('40300')) {
        // Mark conversation as opted out via Django API
        await fetch(`${apiUrl}/api/sms/opt-out/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            conversation_id: conversation.id,
            status: 'opted_out',
          }),
        })

        // Log the failed message
        await logMessage({
          conversationId: conversation.id,
          senderId: userData.id,
          receiverId: userData.id,
          body: message,
          direction: 'outbound',
          status: 'failed',
          metadata: {
            error: 'Client has blocked messages (STOP)',
            error_code: '40300',
            client_phone: deal.client_phone,
            client_name: deal.client_name,
          },
        })

        return NextResponse.json(
          {
            error:
              'Client has blocked messages. They previously sent STOP to unsubscribe.',
          },
          { status: 403 }
        )
      }

      // For other Telnyx errors, throw to be caught by outer handler
      throw telnyxError
    }
  } catch (error) {
    console.error('Send SMS error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send SMS',
      },
      { status: 500 }
    )
  }
}
