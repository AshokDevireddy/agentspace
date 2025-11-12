import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendSMS } from '@/lib/telnyx'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { messageIds } = body // Array of message IDs to approve

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { error: 'Message IDs are required' },
        { status: 400 }
      )
    }

    // Fetch all draft messages with conversation details
    const { data: draftMessages, error: fetchError } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        receiver_id,
        body,
        direction,
        metadata,
        conversations!inner(
          id,
          deal_id,
          client_phone,
          deals!inner(
            id,
            agency_id,
            agencies!inner(
              id,
              phone_number
            )
          )
        )
      `)
      .in('id', messageIds)
      .eq('status', 'draft')

    if (fetchError) {
      console.error('Error fetching draft messages:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch draft messages' },
        { status: 500 }
      )
    }

    if (!draftMessages || draftMessages.length === 0) {
      return NextResponse.json(
        { error: 'No draft messages found with provided IDs' },
        { status: 404 }
      )
    }

    const results = []
    const errors = []

    // Process each draft message
    for (const message of draftMessages) {
      try {
        const conversation = message.conversations
        const deal = conversation.deals
        const agency = deal.agencies

        // Get phone numbers
        const agencyPhone = agency.phone_number
        const clientPhone = conversation.client_phone

        if (!agencyPhone || !clientPhone) {
          throw new Error('Missing phone numbers for sending SMS')
        }

        // Send SMS via Telnyx
        const telnyxResult = await sendSMS({
          from: agencyPhone,
          to: clientPhone,
          text: message.body
        })

        // Update message status to 'sent' and set sent_at timestamp
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

        results.push({
          messageId: message.id,
          success: true,
          telnyxMessageId: telnyxResult.data.id
        })

        console.log(`✅ Draft message ${message.id} approved and sent`)
      } catch (error) {
        console.error(`Error approving message ${message.id}:`, error)
        errors.push({
          messageId: message.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      approved: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Error in approve draft endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
