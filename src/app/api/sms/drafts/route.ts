import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getSmsEndpoint } from '@/lib/api-config'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get view mode from query params (default: 'downlines')
    const { searchParams } = new URL(request.url)
    const viewMode = searchParams.get('view') || 'downlines'

    const url = new URL(getSmsEndpoint('drafts'))
    url.searchParams.set('view', viewMode)

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Drafts API error:', errorData)
      return NextResponse.json(
        { error: errorData.error || 'Failed to fetch drafts' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Transform API response to match expected frontend format
    // API returns flat list, frontend expects grouped by conversation
    const drafts = data.drafts || data || []

    // Group drafts by conversation if not already grouped
    if (Array.isArray(drafts) && drafts.length > 0 && drafts[0].conversation_id) {
      const groupedDrafts = drafts.reduce((acc: any, draft: any) => {
        const convId = draft.conversation_id
        if (!acc[convId]) {
          acc[convId] = {
            conversationId: convId,
            dealId: draft.deal_id,
            clientName: draft.client_name,
            clientPhone: draft.client_phone,
            agentName: draft.agent_name || 'Unknown',
            messages: []
          }
        }
        acc[convId].messages.push({
          id: draft.id,
          body: draft.body,
          direction: draft.direction,
          metadata: draft.metadata,
          createdAt: draft.sent_at || draft.created_at
        })
        return acc
      }, {})

      const draftGroups = Object.values(groupedDrafts)

      return NextResponse.json({
        success: true,
        drafts: draftGroups,
        count: drafts.length
      })
    }

    // If already in expected format, return as-is
    return NextResponse.json({
      success: true,
      drafts: drafts,
      count: data.count || drafts.length || 0
    })

  } catch (error) {
    console.error('Error in get drafts endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
