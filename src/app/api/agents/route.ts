// API ROUTE: /api/agents
// This endpoint fetches all agents with their related data including positions, uplines, and downline counts

import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'table'

    const supabase = createAdminClient()
    const userClient = await createServerClient()

    const { data: { user } } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentUser, error: currentUserError } = await supabase
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

    console.log('Current user:', currentUser.id, 'Agency:', currentUser.agency_id, 'Is Admin:', currentUser.perm_level === 'admin' || currentUser.role === 'admin')

    // Check if user is admin
    const isAdmin = currentUser.perm_level === 'admin' || currentUser.role === 'admin'

    // Fetch all users to build the hierarchy
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        perm_level,
        upline_id,
        created_at,
        status,
        total_prod,
        total_policies_sold,
        role
      `)
      .eq('agency_id', currentUser.agency_id)
      .neq('role', 'client')

    if (allUsersError) {
      console.error('All users fetch error:', allUsersError)
      console.error('Error details:', JSON.stringify(allUsersError, null, 2))
      return NextResponse.json({
        error: 'Failed to fetch users',
        detail: allUsersError.message || 'Database query encountered an error'
      }, { status: 500 })
    }

    console.log('Fetched users count:', allUsers?.length || 0)

    // Build a map of users by their ID and a tree structure
    type BasicUser = NonNullable<typeof allUsers>[number]
    type UserNode = BasicUser & { children: UserNode[] }

    const usersById = new Map<string, UserNode>(
      (allUsers || []).map(u => [u.id as string, { ...(u as BasicUser), children: [] as UserNode[] }])
    )
    const rootUsers: UserNode[] = []

    ;(allUsers || []).forEach(u => {
      if (u.upline_id && usersById.has(u.upline_id as string)) {
        const parent = usersById.get(u.upline_id as string)
        const child = usersById.get(u.id as string)
        if (parent && child) parent.children.push(child)
      } else {
        const node = usersById.get(u.id as string)
        if (node) rootUsers.push(node)
      }
    })

    // Find the current user in the hierarchy
    let currentUserNode: UserNode | null = null
    const findUser = (nodes: UserNode[], userId: string): UserNode | null => {
      for (const node of nodes) {
        if (node.id === userId) return node
        if (node.children.length > 0) {
          const found = findUser(node.children, userId)
          if (found) return found
        }
      }
      return null
    }
    currentUserNode = findUser(rootUsers, currentUser.id);

    // If the current user is not found, it means they might be a child node that wasn't pushed as a root
    if(!currentUserNode){
        const userFromMap = usersById.get(currentUser.id);
        if(userFromMap) {
            currentUserNode = userFromMap;
        }
    }

    // Handle case where there are no agents yet (new agency)
    if (!allUsers || allUsers.length === 0) {
        return NextResponse.json({
            agents: [],
            pagination: {
                currentPage: 1,
                totalPages: 1,
                totalCount: 0,
                limit: 20,
                hasNextPage: false,
                hasPrevPage: false
            },
            tree: {
                name: `${currentUser.last_name}, ${currentUser.first_name}`,
                children: [],
                attributes: { position: 'Admin' }
            }
        });
    }

    if (!currentUserNode) {
        // Return the current user as an agent if no downline exists
         return NextResponse.json({
            agents: [{
              id: currentUser.id,
              name: `${currentUser.last_name}, ${currentUser.first_name}`,
              position: 'Admin',
              upline: 'None',
              created: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              earnings: '$0.00 / $0.00',
              downlines: 0,
              status: 'Active',
              badge: 'Admin',
              children: []
            }],
            pagination: {
                currentPage: 1,
                totalPages: 1,
                totalCount: 1,
                limit: 20,
                hasNextPage: false,
                hasPrevPage: false
            },
            tree: {
              name: `${currentUser.last_name}, ${currentUser.first_name}`,
              children: [],
              attributes: { position: 'Admin' }
            }
        });
    }

    const getDownline = (userNode: UserNode) => {
      const downline: UserNode[] = []
      const queue: UserNode[] = [...userNode.children]
      while (queue.length > 0) {
        const current = queue.shift()
        if (current) {
          downline.push(current)
          if (current.children.length > 0) {
            queue.push(...current.children)
          }
        }
      }
      return downline
    }

    // For admins in table view, show all agency agents. For tree view or non-admins, show downline only
    let visibleUsers: UserNode[]
    if (isAdmin && view === 'table') {
      // Admin sees all users in agency (including pre-invite status)
      visibleUsers = Array.from(usersById.values())
    } else {
      // Non-admin or tree view: show only downline
      visibleUsers = [currentUserNode, ...getDownline(currentUserNode)]
    }

    const uplineIds = visibleUsers
      .map(user => user.upline_id)
      .filter(id => id !== null && id !== undefined)

    // Only fetch uplines if there are any upline IDs
    let uplineMap = new Map<string, string>()
    if (uplineIds.length > 0) {
      const { data: uplines, error: uplinesError } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', uplineIds)

      if (uplinesError) {
        console.error('Uplines fetch error:', uplinesError)
        // Don't fail the whole request, just continue without upline names
      } else {
        uplineMap = new Map(
          uplines?.map(upline => [upline.id, `${upline.last_name}, ${upline.first_name}`]) || []
        )
      }
    }

    type AgentDto = {
      id: string
      name: string
      position: string
      upline: string
      created: string
      lastLogin: string
      earnings: string
      downlines: number
      status: 'Active' | 'Inactive'
      badge: string
      children: AgentDto[]
    }

    const transformUserToAgent = (user: UserNode): AgentDto => {
        // Format permission level nicely
        const permLevel = user.perm_level || 'agent'
        const positionName = permLevel.charAt(0).toUpperCase() + permLevel.slice(1).toLowerCase()

        const uplineName = user.upline_id ? (uplineMap.get(user.upline_id) || 'None') : 'None'
        const downlines = user.children.length

        const totalProd = parseFloat(user.total_prod?.toString() || '0')
        const earnings = `$0.00 / $${totalProd.toFixed(2)}`

        const today = new Date()
        const maxDaysAgo = 2
        const randomDaysAgo = Math.floor(Math.random() * (maxDaysAgo + 1))
        const lastLoginDate = new Date(today)
        lastLoginDate.setDate(today.getDate() - randomDaysAgo)
        const lastLogin = lastLoginDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        })

        return {
            id: user.id,
            name: `${user.last_name}, ${user.first_name}`,
            position: positionName,
            upline: uplineName,
            created: new Date(user.created_at || '').toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
            }),
            lastLogin: lastLogin,
            earnings: earnings,
            downlines: downlines,
            status: user.status === 'active' ? 'Active' : 'Inactive',
            badge: positionName,
            children: user.children.map(transformUserToAgent)
        }
    }

    const agentTree = transformUserToAgent(currentUserNode);

    if (view === 'tree') {
      return NextResponse.json({
        tree: {
            name: agentTree.name,
            attributes: {
                position: agentTree.position,
            },
            children: agentTree.children.map((child: AgentDto) => ({
                name: child.name,
                attributes: { position: child.position },
                children: child.children
            }))
        }
      });
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const paginatedAgents = visibleUsers.slice(offset, offset + limit).map(transformUserToAgent)
    const totalCount = visibleUsers.length
    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      agents: paginatedAgents,
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
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: error instanceof Error ? error.message : 'An unexpected error occurred while fetching agents'
    }, { status: 500 })
  }
}
