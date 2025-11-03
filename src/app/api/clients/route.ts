import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const view = searchParams.get('view') || 'downlines' // 'all', 'self', 'downlines'

    // Get authenticated user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user data
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('id, agency_id, is_admin')
      .eq('auth_user_id', authUser.id)
      .single()

    if (currentUserError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const offset = (page - 1) * limit

    const { data: rows, error: rpcError } = await supabase.rpc('get_clients_overview', {
      p_user_id: currentUser.id,
      p_view: view,
      p_limit: limit,
      p_offset: offset
    })

    if (rpcError) {
      console.error('get_clients_overview RPC error:', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    const totalCount = rows?.[0]?.total_count ? Number(rows[0].total_count) : 0
    const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 0

    const clients = (rows || []).map((row: any) => ({
      id: row.client_id,
      name: row.client_name,
      email: row.client_email || 'N/A',
      phone: row.client_phone || 'N/A',
      supportingAgent: row.supporting_agent || 'N/A',
      status: row.status || 'N/A',
      created: row.created_at
        ? new Date(row.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        : 'N/A'
    }))

    return NextResponse.json({
      clients,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit
      }
    })
  } catch (error: any) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

