// API ROUTE: /api/positions/[id]
// This endpoint manages individual positions
// PUT: Updates a position
// DELETE: Deletes a position

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    const { id: positionId } = await params
    
    if (!positionId) {
      console.error('[Position Update] Missing position ID in URL params')
      return NextResponse.json({
        error: 'Missing position ID',
        detail: 'Position ID is required in the URL'
      }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(positionId)) {
      console.error('[Position Update] Invalid UUID format:', positionId)
      return NextResponse.json({
        error: 'Invalid position ID format',
        detail: 'Position ID must be a valid UUID'
      }, { status: 400 })
    }

    console.log('[Position Update] Received request:', {
      positionId,
      positionIdLength: positionId.length,
      bodyKeys: Object.keys(body)
    })

    const { name, level, description, is_active } = body

    // Validate required fields
    if (!name || level === undefined || level === null) {
      return NextResponse.json({
        error: 'Missing required fields',
        detail: 'name and level are required'
      }, { status: 400 })
    }

    // Validate level is a positive integer
    if (!Number.isInteger(level) || level < 0) {
      return NextResponse.json({
        error: 'Invalid level',
        detail: 'level must be a positive integer'
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

    // Get the user's agency_id from the users table
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('agency_id')
      .eq('auth_user_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({
        error: 'User not found',
        detail: 'Failed to fetch user information'
      }, { status: 404 })
    }

    const agencyId = userData.agency_id

    if (!agencyId) {
      return NextResponse.json({
        error: 'User not associated with an agency',
        detail: 'User must be associated with an agency to update positions'
      }, { status: 403 })
    }

    // Update the position (only if it belongs to the user's agency)
    const { data: position, error } = await supabase
      .from('positions')
      .update({
        name,
        level,
        description: description || null,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', positionId)
      .eq('agency_id', agencyId)
      .select()
      .single()

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({
          error: 'A position with this name already exists in your agency.',
          detail: error.message
        }, { status: 409 })
      }

      console.error('Position update error:', error)
      return NextResponse.json({
        error: 'Failed to update position',
        detail: 'Database update encountered an error'
      }, { status: 500 })
    }

    if (!position) {
      return NextResponse.json({
        error: 'Position not found',
        detail: 'Position does not exist or does not belong to your agency'
      }, { status: 404 })
    }

    return NextResponse.json({ position })

  } catch (error) {
    console.error('API Error in position update:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while updating position'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient()
    const { id: positionId } = await params
    
    if (!positionId) {
      console.error('[Position Delete] Missing position ID in URL params')
      return NextResponse.json({
        error: 'Missing position ID',
        detail: 'Position ID is required in the URL'
      }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(positionId)) {
      console.error('[Position Delete] Invalid UUID format:', positionId)
      return NextResponse.json({
        error: 'Invalid position ID format',
        detail: 'Position ID must be a valid UUID'
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

    // Get the user's agency_id from the users table
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('agency_id')
      .eq('auth_user_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({
        error: 'User not found',
        detail: 'Failed to fetch user information'
      }, { status: 404 })
    }

    const agencyId = userData.agency_id

    if (!agencyId) {
      return NextResponse.json({
        error: 'User not associated with an agency',
        detail: 'User must be associated with an agency to delete positions'
      }, { status: 403 })
    }

    // Check if there are any agents assigned to this position
    const { data: assignedAgents, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('position_id', positionId)
      .eq('agency_id', agencyId)
      .limit(1)

    if (checkError) {
      console.error('Position check error:', checkError)
      return NextResponse.json({
        error: 'Failed to check position usage',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    if (assignedAgents && assignedAgents.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete position',
        detail: 'This position is currently assigned to one or more agents. Please reassign them first.'
      }, { status: 400 })
    }

    // Delete the position (only if it belongs to the user's agency)
    const { error } = await supabase
      .from('positions')
      .delete()
      .eq('id', positionId)
      .eq('agency_id', agencyId)

    if (error) {
      console.error('Position deletion error:', error)
      return NextResponse.json({
        error: 'Failed to delete position',
        detail: 'Database delete encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('API Error in position deletion:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while deleting position'
    }, { status: 500 })
  }
}
