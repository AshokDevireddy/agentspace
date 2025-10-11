// API ROUTE: /api/positions
// This endpoint fetches all available positions from the positions table
// Used to populate position dropdown in user creation forms
// Also handles creating new positions

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Create admin Supabase client
    // Security: Middleware protects this route from non-admin access
    const supabase = createAdminClient()

    // Optional: scope by agency_id via query param `agencyId`
    const { searchParams } = new URL(request.url)
    const agencyId = searchParams.get('agencyId')

    const query = supabase
      .from('positions')
      .select(`id, name`)
      .order('name', { ascending: true })

    const { data: positions, error: fetchError } = agencyId
      ? await query.eq('agency_id', agencyId)
      : await query

    if (fetchError) {
      console.error('Positions fetch error:', fetchError)
      return NextResponse.json({
        error: 'Failed to fetch positions',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    } else {
        console.log("All Positions:", positions);
    }

    // Return positions array
    // Transform to include value/label format for dropdown compatibility
    const formattedPositions = positions?.map(position => ({
      value: position.id,
      label: position.name
    })) || []

    return NextResponse.json(formattedPositions)

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
    // Create admin client for database operations
    const supabase = createAdminClient()

    // Parse request body
    const body = await request.json()
    const { name, level, base_commission_rate, is_active, created_by } = body

    // Validate that created_by (user ID) is provided
    if (!created_by) {
      return NextResponse.json({
        error: 'Missing user ID',
        detail: 'User ID is required to create positions'
      }, { status: 400 })
    }

    // Validate that the user exists and is active
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, is_active, agency_id')
      .eq('id', created_by)
      .eq('is_active', true)
      .single()

    if (userError || !user) {
      return NextResponse.json({
        error: 'Invalid user',
        detail: 'User does not exist or is not active'
      }, { status: 401 })
    }

    // Validate required fields
    if (!name || level === undefined) {
      return NextResponse.json({
        error: 'Missing required fields',
        detail: 'Name and level are required'
      }, { status: 400 })
    }

    // Validate level is a positive integer
    if (!Number.isInteger(level) || level < 0) {
      return NextResponse.json({
        error: 'Invalid level',
        detail: 'Level must be a positive integer'
      }, { status: 400 })
    }

    // Validate base commission rate if provided
    if (base_commission_rate !== undefined && (isNaN(base_commission_rate) || base_commission_rate < 1 || base_commission_rate > 200)) {
      return NextResponse.json({
        error: 'Invalid base commission rate',
        detail: 'Base commission rate must be between 1 and 200'
      }, { status: 400 })
    }

    // Insert new position
    const { data: position, error: insertError } = await supabase
      .from('positions')
      .insert({
        name: name.trim(),
        level: level,
        base_commission_rate: base_commission_rate || 0,
        is_active: is_active !== undefined ? is_active : true,
        created_by: created_by,
        agency_id: user.agency_id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Position insert error:', insertError)

      // Check for unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json({
          error: 'Position already exists',
          detail: 'A position with this name already exists'
        }, { status: 409 })
      }

      return NextResponse.json({
        error: 'Failed to create position',
        detail: 'Database insert encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      position: position
    }, { status: 201 })

  } catch (error) {
    console.error('API Error in positions POST:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while creating position'
    }, { status: 500 })
  }
}