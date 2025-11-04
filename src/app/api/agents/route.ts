// API ROUTE: /api/agents
// This endpoint fetches all agents with their related data including positions, uplines, and downline counts

import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const formatPosition = (permLevel?: string | null) => {
  const value = permLevel || 'agent'
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

const formatDateTime = (iso?: string | null) => {
  if (!iso) return 'N/A'
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

const generateLastLogin = () => {
  const today = new Date()
  const lastLoginDate = new Date(today)
  const randomDaysAgo = Math.floor(Math.random() * 3)
  lastLoginDate.setDate(today.getDate() - randomDaysAgo)
  return lastLoginDate.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

type TreeRow = {
  agent_id: string
  first_name: string
  last_name: string
  perm_level: string | null
  upline_id: string | null
}

const buildTree = (rows: TreeRow[], rootId: string) => {
  const byId = new Map<string, TreeRow & { children: string[] }>()
  rows.forEach((row) => {
    byId.set(row.agent_id, { ...row, children: [] })
  })

  byId.forEach((row) => {
    if (row.upline_id && byId.has(row.upline_id) && row.agent_id !== row.upline_id) {
      byId.get(row.upline_id)!.children.push(row.agent_id)
    }
  })

  const visit = (id: string, seen: Set<string>) => {
    if (seen.has(id)) return
    seen.add(id)
    const node = byId.get(id)
    if (!node) return
    node.children.forEach((childId) => visit(childId, seen))
  }

  const reachable = new Set<string>()
  visit(rootId, reachable)

  // Only include agents that are reachable from the root through upline connections
  // Do not add agents without uplines as direct children of root

  const toNode = (id: string): any => {
    const node = byId.get(id)
    // Only include nodes that are reachable from the root
    if (!node || !reachable.has(id)) return null
    return {
      name: `${node.last_name}, ${node.first_name}`,
      attributes: {
        position: formatPosition(node.perm_level)
      },
      children: node.children
        .map(toNode)
        .filter(Boolean)
    }
  }

  return toNode(rootId) || null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'table'

    const inUpline = searchParams.get('inUpline')
    const directUpline = searchParams.get('directUpline')
    const inDownline = searchParams.get('inDownline')
    const directDownline = searchParams.get('directDownline')
    const agentName = searchParams.get('agentName')
    const status = searchParams.get('status')

    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit

    const supabaseAdmin = createAdminClient()
    const supabaseUser = await createServerClient()

    const { data: { user } } = await supabaseUser.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, agency_id, perm_level, role')
      .eq('auth_user_id', user.id)
      .single()

    if (currentUserError || !currentUser) {
      console.error('Current user fetch error:', currentUserError)
      return NextResponse.json({
        error: 'Failed to fetch current user',
        detail: currentUserError?.message || 'User not found'
      }, { status: 500 })
    }

    const isAdmin = currentUser.perm_level === 'admin' || currentUser.role === 'admin'

    if (view === 'tree') {
      const { data: hierarchyRows, error: hierarchyError } = await supabaseAdmin.rpc('get_agents_hierarchy_nodes', {
        p_user_id: currentUser.id,
        p_include_full_agency: isAdmin
      })

      if (hierarchyError) {
        console.error('get_agents_hierarchy_nodes RPC error:', hierarchyError)
        return NextResponse.json({ error: hierarchyError.message }, { status: 500 })
      }

      if (!hierarchyRows || hierarchyRows.length === 0) {
        return NextResponse.json({
          tree: {
            name: `${currentUser.last_name}, ${currentUser.first_name}`,
            attributes: { position: formatPosition(currentUser.perm_level) },
            children: []
          }
        })
      }

      const tree = buildTree(hierarchyRows as TreeRow[], currentUser.id)

      return NextResponse.json({
        tree: tree || {
          name: `${currentUser.last_name}, ${currentUser.first_name}`,
          attributes: { position: formatPosition(currentUser.perm_level) },
          children: []
        }
      })
    }

    const filters = {
      in_upline: inUpline && inUpline !== 'all' ? inUpline : null,
      direct_upline: directUpline && directUpline !== 'all' ? directUpline : null,
      in_downline: inDownline && inDownline !== 'all' ? inDownline : null,
      direct_downline: directDownline && directDownline !== 'all' ? directDownline : null,
      agent_name: agentName && agentName !== 'all' ? agentName : null,
      status: status && status !== 'all' ? status : null
    }

    const includeFullAgency = isAdmin && view === 'table'

    const { data: tableRows, error: tableError } = await supabaseAdmin.rpc('get_agents_table', {
      p_user_id: currentUser.id,
      p_filters: filters,
      p_limit: limit,
      p_offset: offset,
      p_include_full_agency: includeFullAgency
    })

    if (tableError) {
      console.error('get_agents_table RPC error:', tableError)
      return NextResponse.json({ error: tableError.message }, { status: 500 })
    }

    const totalCount = tableRows?.[0]?.total_count ? Number(tableRows[0].total_count) : 0
    const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 0

    const agents = (tableRows || []).map((row: any) => {
      const position = formatPosition(row.perm_level)
      const totalProd = Number(row.total_prod || 0)

      return {
        id: row.agent_id,
        name: `${row.last_name}, ${row.first_name}`,
        position,
        upline: row.upline_name || 'None',
        created: formatDateTime(row.created_at),
        lastLogin: generateLastLogin(),
        earnings: `$0.00 / $${totalProd.toFixed(2)}`,
        downlines: Number(row.downline_count || 0),
        status: row.status || 'active',
        badge: position,
        children: []
      }
    })

    const { data: optionRows, error: optionsError } = await supabaseAdmin.rpc('get_agent_options', {
      p_user_id: currentUser.id,
      p_include_full_agency: includeFullAgency
    })

    if (optionsError) {
      console.error('get_agent_options RPC error:', optionsError)
      return NextResponse.json({ error: optionsError.message }, { status: 500 })
    }

    const allAgents = (optionRows || []).map((row: any) => ({
      id: row.agent_id,
      name: row.display_name
    }))

    return NextResponse.json({
      agents,
      allAgents,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    })
  } catch (error) {
    console.error('API Error in agents:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: error instanceof Error ? error.message : 'An unexpected error occurred while fetching agents'
    }, { status: 500 })
  }
}
