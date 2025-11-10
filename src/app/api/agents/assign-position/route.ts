// API ROUTE: /api/agents/assign-position
// This endpoint assigns a position to an agent
// POST: Assigns/updates an agent's position (with permission checks)

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const { agent_id, position_id } = body

    // Validate required fields
    if (!agent_id || !position_id) {
      return NextResponse.json({
        error: 'Missing required fields',
        detail: 'agent_id and position_id are required'
      }, { status: 400 })
    }

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

    // Use RPC function to update agent position (handles permission checks)
    const { data: result, error: updateError } = await supabase
      .rpc('update_agent_position', {
        p_user_id: userId,
        p_agent_id: agent_id,
        p_position_id: position_id
      })

    if (updateError) {
      console.error('Agent position update error:', updateError)
      return NextResponse.json({
        error: 'Failed to update agent position',
        detail: updateError.message
      }, { status: 500 })
    }

    // Check if the RPC returned an error
    if (result && !result.success) {
      return NextResponse.json({
        error: result.error || 'Failed to update agent position',
        detail: 'Permission denied or invalid data'
      }, { status: 403 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('API Error in agent position assignment:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while assigning position'
    }, { status: 500 })
  }
}
