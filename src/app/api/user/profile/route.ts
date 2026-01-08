import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// THIS ENDPOINT SHOULD BE USING SUPABASE/SSR BC AUTH HELPER IS DEPRECATED
// https://supabase.com/docs/guides/auth/server-side/nextjs?queryGroups=router&router=hybrid
// https://supabase.com/docs/guides/auth/auth-helpers/nextjs

export async function GET(request: Request) {
  try {
    // Get user_id from URL search params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id parameter is required' },
        { status: 400 }
      )
    }

    // ⚠️  SECURITY WARNING: Using admin client for TESTING ONLY
    // This bypasses ALL RLS policies - replace with proper server client later
    const supabase = createAdminClient()

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        created_at,
        agency_id,
        status,
        role,
        is_admin,
        position_id,
        subscription_status,
        subscription_tier,
        deals_created_count,
        ai_requests_count,
        messages_sent_count,
        billing_cycle_start,
        billing_cycle_end,
        scheduled_tier_change,
        scheduled_tier_change_date,
        theme_mode,
        position:positions(id, name, level)
      `)
      .eq('auth_user_id', userId)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    const profileData = {
      id: userData.id,
      firstName: userData.first_name,
      lastName: userData.last_name,
      fullName: `${userData.first_name} ${userData.last_name}`,
      createdAt: userData.created_at,
      agency_id: userData.agency_id || null,
      status: userData.status,
      role: userData.role,
      is_admin: userData.is_admin,
      position_id: userData.position_id || null,
      position: userData.position || null,
      subscription_status: userData.subscription_status || 'free',
      subscription_tier: userData.subscription_tier || 'free',
      deals_created_count: userData.deals_created_count || 0,
      ai_requests_count: userData.ai_requests_count || 0,
      messages_sent_count: userData.messages_sent_count || 0,
      billing_cycle_start: userData.billing_cycle_start || null,
      billing_cycle_end: userData.billing_cycle_end || null,
      scheduled_tier_change: userData.scheduled_tier_change || null,
      scheduled_tier_change_date: userData.scheduled_tier_change_date || null,
      theme_mode: userData.theme_mode || null,
    }

    return NextResponse.json({
      success: true,
      data: profileData
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT endpoint to update user's position (admin only)
export async function PUT(request: Request) {
  try {
    const supabase = createAdminClient()

    // Get the authorization header
    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the token and get user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    // Get user details to check if admin
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, is_admin, role, perm_level, agency_id')
      .eq('auth_user_id', user.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user is admin
    const isAdmin = currentUser.role === 'admin'

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can update positions' },
        { status: 403 }
      )
    }

    // Get the position_id from request body
    const body = await request.json()
    const { position_id } = body

    if (!position_id) {
      return NextResponse.json(
        { error: 'position_id is required' },
        { status: 400 }
      )
    }

    // Verify the position belongs to the same agency
    const { data: position, error: positionError } = await supabase
      .from('positions')
      .select('id, agency_id')
      .eq('id', position_id)
      .single()

    if (positionError || !position) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      )
    }

    if (position.agency_id !== currentUser.agency_id) {
      return NextResponse.json(
        { error: 'Position does not belong to your agency' },
        { status: 403 }
      )
    }

    // Update the user's position
    const { error: updateError } = await supabase
      .from('users')
      .update({ position_id: position_id, updated_at: new Date().toISOString() })
      .eq('id', currentUser.id)

    if (updateError) {
      console.error('Error updating position:', updateError)
      return NextResponse.json(
        { error: 'Failed to update position' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Position updated successfully'
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}