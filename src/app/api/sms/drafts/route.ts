import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
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

    // Get view mode from query params (default: 'downlines')
    const { searchParams } = new URL(request.url)
    const viewMode = searchParams.get('view') || 'downlines'

    // Get user details to check if admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, is_admin')
      .eq('auth_user_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Downgrade 'all' to 'downlines' for non-admins (defense in depth)
    const effectiveView = (viewMode === 'all' && !userData.is_admin) ? 'downlines' : viewMode

    const { data: drafts, error } = await supabase.rpc('get_draft_messages', {
      p_user_id: userData.id,
      p_view: effectiveView,
    })

    if (error) {
      console.error('Error fetching drafts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch drafts' },
        { status: 500 }
      )
    }

    // Group drafts by conversation
    const groupedDrafts = drafts?.reduce((acc: any, draft: any) => {
      const convId = draft.conversation_id
      if (!acc[convId]) {
        acc[convId] = {
          conversationId: convId,
          dealId: draft.conversations?.deals?.id,
          clientName: draft.conversations?.deals?.client_name,
          clientPhone: draft.conversations?.deals?.client_phone,
          agentName: draft.conversations?.deals?.users
            ? `${draft.conversations.deals.users.first_name} ${draft.conversations.deals.users.last_name}`
            : 'Unknown',
          messages: []
        }
      }
      acc[convId].messages.push({
        id: draft.id,
        body: draft.body,
        direction: draft.direction,
        metadata: draft.metadata,
        createdAt: draft.sent_at // Will be null for drafts
      })
      return acc
    }, {})

    const draftGroups = Object.values(groupedDrafts || {})

    return NextResponse.json({
      success: true,
      drafts: draftGroups,
      count: drafts?.length || 0
    })

  } catch (error) {
    console.error('Error in get drafts endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
