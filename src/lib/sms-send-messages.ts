import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, isLandlineError, isInvalidPhoneError, isValidPhoneNumber, getPhoneValidationError } from '@/lib/telnyx'
import { incrementMessageCount } from '@/lib/sms-billing'

interface SendMessagesConfig {
  sourceStatus: 'draft' | 'failed'
  resultKey: string
  logLabel: string
}

/**
 * Shared pipeline for sending SMS messages by ID.
 * Used by both the draft-approve and failed-retry endpoints.
 */
export async function sendMessagesByIds(request: NextRequest, config: SendMessagesConfig) {
  const { sourceStatus, resultKey, logLabel } = config

  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { messageIds } = body

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { error: 'Message IDs are required' },
        { status: 400 }
      )
    }

    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('id, conversation_id, body, sender_id')
      .in('id', messageIds)
      .eq('status', sourceStatus)

    if (fetchError) {
      console.error(`Error fetching ${sourceStatus} messages:`, fetchError)
      return NextResponse.json(
        { error: `Failed to fetch ${sourceStatus} messages` },
        { status: 500 }
      )
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: `No ${sourceStatus} messages found with provided IDs` },
        { status: 404 }
      )
    }

    // Batch-fetch conversations, deals, and agencies upfront
    const conversationIds = [...new Set(messages.map(m => m.conversation_id))]

    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, deal_id, client_phone, agency_id')
      .in('id', conversationIds)

    const conversationMap = new Map(
      (conversations || []).map(c => [c.id, c])
    )

    // Fetch deals for conversations that have a deal_id
    const dealIds = [...new Set(
      (conversations || [])
        .map(c => c.deal_id)
        .filter((id): id is string => !!id)
    )]

    const dealMap = new Map<string, { agency_id: string | null }>()
    if (dealIds.length > 0) {
      const { data: deals } = await supabase
        .from('deals')
        .select('id, agency_id')
        .in('id', dealIds)

      for (const deal of deals || []) {
        dealMap.set(deal.id, deal)
      }
    }

    // Collect all agency IDs (prefer deal's agency, fall back to conversation's)
    const agencyIds = new Set<string>()
    for (const conv of conversations || []) {
      const deal = conv.deal_id ? dealMap.get(conv.deal_id) : null
      const agencyId = deal?.agency_id || conv.agency_id
      if (agencyId) agencyIds.add(agencyId)
    }

    const agencyPhoneMap = new Map<string, string>()
    if (agencyIds.size > 0) {
      const { data: agencies } = await supabase
        .from('agencies')
        .select('id, phone_number')
        .in('id', [...agencyIds])

      for (const agency of agencies || []) {
        if (agency.phone_number) {
          agencyPhoneMap.set(agency.id, agency.phone_number)
        }
      }
    }

    const results = []
    const errors = []

    for (const message of messages) {
      try {
        const conversation = conversationMap.get(message.conversation_id)

        if (!conversation) {
          throw new Error(`Conversation not found for message ${message.id}`)
        }

        if (!conversation.client_phone) {
          throw new Error(`Missing client phone number for conversation ${conversation.id}`)
        }

        const deal = conversation.deal_id ? dealMap.get(conversation.deal_id) : null
        const agencyId = deal?.agency_id || conversation.agency_id
        const agencyPhone = agencyId ? agencyPhoneMap.get(agencyId) : null

        if (!agencyPhone) {
          throw new Error(`Missing agency phone number for conversation ${conversation.id} (deal_id: ${conversation.deal_id || 'none'})`)
        }

        // Pre-flight: reject invalid phone numbers before calling Telnyx
        if (!isValidPhoneNumber(conversation.client_phone)) {
          const phoneError = getPhoneValidationError(conversation.client_phone) || 'Invalid phone number.';
          console.error(`Invalid client phone for message ${message.id}: ${conversation.client_phone}`)
          await supabase
            .from('messages')
            .update({ status: 'failed', metadata: { error: phoneError, error_code: '40310' } })
            .eq('id', message.id)

          errors.push({
            messageId: message.id,
            error: phoneError
          })
          continue
        }

        const telnyxResult = await sendSMS({
          from: agencyPhone,
          to: conversation.client_phone,
          text: message.body
        })

        const { error: updateError } = await supabase
          .from('messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', message.id)

        if (updateError) {
          throw new Error(`Failed to update message: ${updateError.message}`)
        }

        if (message.sender_id) {
          await incrementMessageCount(message.sender_id)
        }

        results.push({
          messageId: message.id,
          success: true,
          telnyxMessageId: telnyxResult.data.id
        })

        console.log(`${logLabel} message ${message.id} ${resultKey} and sent`)
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error)

        if (isLandlineError(error)) {
          await supabase
            .from('messages')
            .update({ status: 'failed', metadata: { error: 'Landline number cannot receive SMS', error_code: '40001' } })
            .eq('id', message.id)

          errors.push({
            messageId: message.id,
            error: 'Landline number cannot receive SMS'
          })
        } else if (isInvalidPhoneError(error)) {
          const conv = conversationMap.get(message.conversation_id)
          const phoneError = getPhoneValidationError(conv?.client_phone) || `Phone number ${conv?.client_phone || 'unknown'} was rejected by the carrier as undeliverable.`;
          await supabase
            .from('messages')
            .update({ status: 'failed', metadata: { error: phoneError, error_code: '40310' } })
            .eq('id', message.id)

          errors.push({
            messageId: message.id,
            error: phoneError
          })
        } else {
          errors.push({
            messageId: message.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      [resultKey]: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error(`Error in ${sourceStatus} send endpoint:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
