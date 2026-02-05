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

    const { data: draftMessages, error: fetchError } = await supabase
      .from('messages')
      .select('id, conversation_id, body')
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

    // Batch-fetch conversations, deals, and agencies upfront
    const conversationIds = [...new Set(draftMessages.map(m => m.conversation_id))]

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

    for (const message of draftMessages) {
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
