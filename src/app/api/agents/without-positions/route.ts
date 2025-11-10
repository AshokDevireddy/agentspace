// API ROUTE: /api/agents/without-positions
// This endpoint fetches agents who don't have a position assigned yet
// Admins see all agents in their agency, agents see their downlines

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()

    // Get the authorization header
    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Unauthorized',
        detail: 'No valid token provided'
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the token and get user info
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({
        error: 'Unauthorized',
        detail: 'Invalid token'
      }, { status: 401 })
    }

    // Get the user's id from the users table
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({
        error: 'User not found',
        detail: 'Failed to fetch user information'
      }, { status: 404 })
    }

    const { id: userId } = userData

    // Use RPC function to get agents without positions
    const { data: agents, error: fetchError } = await supabase
      .rpc('get_agents_without_positions', { p_user_id: userId })

    if (fetchError) {
      console.error('Agents without positions fetch error:', {
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint,
        code: fetchError.code
      })
      return NextResponse.json({
        error: 'Failed to fetch agents',
        detail: `Database query encountered an error: ${fetchError.message}`,
        details: fetchError.details,
        hint: fetchError.hint,
        code: fetchError.code
      }, { status: 500 })
    }

    // Return agents with count
    const agentList = agents || []
    return NextResponse.json({
      agents: agentList,
      count: agentList.length
    })

  } catch (error) {
    console.error('API Error in agents without positions:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching agents'
    }, { status: 500 })
  }
}
