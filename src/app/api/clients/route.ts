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

    const user = currentUser as any

    // Handle 'all' view differently - query users table directly
    if (view === 'all' && user.is_admin) {
      // Admin viewing all clients in agency - query directly from users table
      const offset = (page - 1) * limit

      // Get total count
      const { count, error: countError } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', user.agency_id)
        .eq('role', 'client')

      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 500 })
      }

      const totalCount = count || 0
      const totalPages = Math.ceil(totalCount / limit)

      // Get paginated clients
      const { data: clients, error: clientsError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, phone_number, status, created_at')
        .eq('agency_id', user.agency_id)
        .eq('role', 'client')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (clientsError) {
        return NextResponse.json({ error: clientsError.message }, { status: 500 })
      }

      // For each client, get their supporting agent (from deals)
      const clientsWithAgents = await Promise.all(
        (clients || []).map(async (client: any) => {
          const { data: deal, error: dealError } = await supabase
            .from('deals')
            .select(`
              agent_id,
              agent:agent_id (
                id,
                first_name,
                last_name
              )
            `)
            .eq('client_id', client.id)
            .limit(1)
            .single()

          let agentName = 'N/A'
          if (!dealError && deal?.agent) {
            const agent = deal.agent as any
            agentName = `${agent.first_name} ${agent.last_name}`
          }

          return {
            id: client.id,
            name: `${client.first_name} ${client.last_name}`,
            email: client.email || 'N/A',
            phone: client.phone_number || 'N/A',
            supportingAgent: agentName,
            status: client.status,
            created: new Date(client.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })
          }
        })
      )

      return NextResponse.json({
        clients: clientsWithAgents,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit
        }
      })
    }

    // For 'self' and 'downlines' views, use the deal-based approach
    let clientIds: string[] = []

    if (view === 'self') {
      // Show only clients where current user is the direct agent
      const { data: selfDeals, error: selfDealsError } = await supabase
        .from('deals')
        .select('client_id')
        .eq('agent_id', user.id)
        .not('client_id', 'is', null)

      if (selfDealsError) {
        return NextResponse.json({ error: selfDealsError.message }, { status: 500 })
      }

      clientIds = [...new Set((selfDeals || []).map((d: any) => d.client_id).filter(Boolean))] as string[]
    } else {
      // Downlines only (excluding self) - default for agents and admins
      // First, get all downline agents
      const { data: downlineAgents, error: downlineError } = await supabase
        .rpc('get_agent_downline', { agent_id: user.id })

      if (downlineError) {
        console.error('Error fetching downlines:', downlineError)
        return NextResponse.json({ error: downlineError.message }, { status: 500 })
      }

      const downlineIds = (downlineAgents || []).map((a: any) => a.id)

      // Get all deals for downline agents
      if (downlineIds.length > 0) {
        const { data: downlineDeals, error: downlineDealsError } = await supabase
          .from('deals')
          .select('client_id')
          .in('agent_id', downlineIds)
          .not('client_id', 'is', null)

        if (downlineDealsError) {
          return NextResponse.json({ error: downlineDealsError.message }, { status: 500 })
        }

        clientIds = [...new Set((downlineDeals || []).map((d: any) => d.client_id).filter(Boolean))] as string[]
      }
    }

    if (clientIds.length === 0) {
      return NextResponse.json({
        clients: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          limit
        }
      })
    }

    // Get client details with their supporting agent info
    const offset = (page - 1) * limit

    // First get total count
    const { count, error: countError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .in('id', clientIds)

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    // Get paginated clients
    const { data: clients, error: clientsError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, phone_number, status, created_at')
      .in('id', clientIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (clientsError) {
      return NextResponse.json({ error: clientsError.message }, { status: 500 })
    }

    // For each client, get their supporting agent (from deals)
    const clientsWithAgents = await Promise.all(
      (clients || []).map(async (client: any) => {
        const { data: deal, error: dealError } = await supabase
          .from('deals')
          .select(`
            agent_id,
            agent:agent_id (
              id,
              first_name,
              last_name
            )
          `)
          .eq('client_id', client.id)
          .limit(1)
          .single()

        let agentName = 'N/A'
        if (!dealError && deal?.agent) {
          const agent = deal.agent as any
          agentName = `${agent.first_name} ${agent.last_name}`
        }

        return {
          id: client.id,
          name: `${client.first_name} ${client.last_name}`,
          email: client.email || 'N/A',
          phone: client.phone_number || 'N/A',
          supportingAgent: agentName,
          status: client.status,
          created: new Date(client.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        }
      })
    )

    return NextResponse.json({
      clients: clientsWithAgents,
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

