// API ROUTE: /api/user/modal-init-data
// This endpoint provides all necessary data for initializing the Add User Modal
// Returns: positions, user profile, default upline agents, admin status
// This eliminates multiple sequential API calls and race conditions

import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Create server client (handles cookie-based auth automatically)
    const supabase = await createServerClient()

    // Verify authentication via cookies
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()

    if (userError || !authUser) {
      return NextResponse.json({
        error: 'Unauthorized',
        detail: 'Authentication required'
      }, { status: 401 })
    }

    // Use admin client for database queries
    const adminClient = createAdminClient()

    // Get the user's data from the users table
    const { data: userData, error: userDataError } = await adminClient
      .from('users')
      .select('id, agency_id, position_id, position:positions(level), role, is_admin, perm_level, first_name, last_name, email')
      .eq('auth_user_id', authUser.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({
        error: 'User not found',
        detail: 'Failed to fetch user information'
      }, { status: 404 })
    }

    const { id: userId } = userData

    // Determine user's position level and admin status
    const userPositionLevel = userData.position?.level ?? null
    const isAdmin = userData.is_admin || userData.perm_level === 'admin' || userData.role === 'admin'

    // Fetch positions using RPC
    const { data: positions, error: positionsError } = await adminClient
      .rpc('get_positions_for_agency', { p_user_id: userId })

    if (positionsError) {
      console.error('Positions fetch error:', positionsError)
      return NextResponse.json({
        error: 'Failed to fetch positions',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    // Filter positions based on user's role
    const filteredPositions = isAdmin
      ? positions
      : userPositionLevel !== null && userPositionLevel !== undefined
        ? (positions || []).filter((p: any) => p.level <= userPositionLevel)
        : positions

    // Transform positions to select options
    const positionOptions = (filteredPositions || []).map((pos: any) => ({
      value: pos.position_id || pos.id,
      label: `${pos.name} (Level ${pos.level})`,
      level: pos.level
    }))

    // Fetch downline agents for upline selection
    // Admins see all agents in agency, regular agents see self + downline
    let downlineAgents: any[] = []

    try {
      let visibleAgentIds: string[] = []

      if (isAdmin) {
        // Admins can see all agents in the agency
        const { data: allAgentsData, error: allAgentsError } = await adminClient
          .from('users')
          .select('id')
          .eq('agency_id', userData.agency_id)
          .neq('role', 'client')
          .in('status', ['active', 'invited', 'onboarding'])

        if (allAgentsError) {
          console.error('Error fetching all agents for admin:', allAgentsError)
        } else {
          visibleAgentIds = (allAgentsData || []).map((u: any) => u.id)
        }
      } else {
        // Regular agents see self + their downline
        const { data: downlineData, error: downlineError } = await adminClient
          .rpc('get_agent_downline', {
            agent_id: userId,
          })

        if (downlineError) {
          console.error('Downline fetch error:', downlineError)
          // At minimum, include the current user
          visibleAgentIds = [userId]
        } else {
          // Include current user + all their downline
          visibleAgentIds = [
            userId,
            ...((downlineData as any[])?.map((u: any) => u.id) || []),
          ]
        }
      }

      // Query these visible agents
      // Limit to 50 for initial load - users can search for more via the search API
      if (visibleAgentIds.length > 0) {
        const { data: agentsData, error: agentsError } = await adminClient
          .from('users')
          .select('id, first_name, last_name, email, status')
          .in('id', visibleAgentIds)
          .in('status', ['active', 'invited', 'onboarding'])
          .neq('role', 'client')
          .order('last_name', { ascending: true })
          .limit(50)

        if (!agentsError && agentsData) {
          downlineAgents = agentsData.map((agent: any) => ({
            value: agent.id,
            label: `${agent.first_name} ${agent.last_name}${agent.email ? ' - ' + agent.email : ''}`,
            status: agent.status
          }))
        } else {
          console.error('Error fetching agents data:', agentsError)
        }
      }
    } catch (error) {
      console.error('Error fetching downline agents:', error)
      // Don't fail the request, just return empty downline
    }

    // Build default upline (current user)
    const defaultUpline = {
      userId: userData.id,
      userLabel: `${userData.first_name} ${userData.last_name} - ${userData.email}`,
      isAdmin
    }

    return NextResponse.json({
      positions: positionOptions,
      userPositionLevel,
      isAdmin,
      currentUser: defaultUpline,
      downlineAgents: downlineAgents
    })

  } catch (error) {
    console.error('API Error in modal-init-data:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching modal data'
    }, { status: 500 })
  }
}
