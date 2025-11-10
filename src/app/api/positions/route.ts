// API ROUTE: /api/positions
// This endpoint manages positions for an agency
// GET: Fetches all positions for the user's agency
// POST: Creates a new position

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

    // Get the user's agency_id and id from the users table
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, agency_id')
      .eq('auth_user_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({
        error: 'User not found',
        detail: 'Failed to fetch user information'
      }, { status: 404 })
    }

    const { id: userId } = userData

    // Use RPC function to get positions for agency
    const { data: positions, error: fetchError } = await supabase
      .rpc('get_positions_for_agency', { p_user_id: userId })

    if (fetchError) {
      console.error('Positions fetch error:', fetchError)
      return NextResponse.json({
        error: 'Failed to fetch positions',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json(positions || [])

  } catch (error) {
    console.error('API Error in positions:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching positions'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

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
        detail: 'User must be associated with an agency to create positions'
      }, { status: 403 })
    }

    // Insert the new position with agency_id
    const { data: position, error } = await supabase
      .from('positions')
      .insert({
        agency_id: agencyId,
        name,
        level,
        description: description || null,
        is_active: is_active !== undefined ? is_active : true,
      })
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

      console.error('Position creation error:', error)
      return NextResponse.json({
        error: 'Failed to create position',
        detail: 'Database insert encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({ position }, { status: 201 })

  } catch (error) {
    console.error('API Error in position creation:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while creating position'
    }, { status: 500 })
  }
}
