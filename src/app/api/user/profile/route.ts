import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()

    // Authenticate the request
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user_id from URL search params (optional - defaults to current user)
    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('user_id')

    // Use the authenticated user's ID (users can only fetch their own profile)
    // If user_id is provided, it must match the authenticated user
    const userId = user.id
    if (requestedUserId && requestedUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - can only access your own profile' },
        { status: 403 }
      )
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        phone_number,
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
        sms_auto_send_enabled,
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

    let agencySmsAutoSendEnabled = true
    if (userData.agency_id) {
      const { data: agencyData } = await supabase
        .from('agencies')
        .select('sms_auto_send_enabled')
        .eq('id', userData.agency_id)
        .single()
      if (agencyData) {
        agencySmsAutoSendEnabled = agencyData.sms_auto_send_enabled ?? true
      }
    }

    const profileData = {
      id: userData.id,
      firstName: userData.first_name,
      lastName: userData.last_name,
      fullName: `${userData.first_name} ${userData.last_name}`,
      phone_number: userData.phone_number || null,
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
      sms_auto_send_enabled: userData.sms_auto_send_enabled ?? null,
      agency_sms_auto_send_enabled: agencySmsAutoSendEnabled,
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

// PUT endpoint to update user profile
// - All authenticated users can update: first_name, last_name, phone_number, theme_mode
// - Only admins can update: position_id
export async function PUT(request: Request) {
  try {
    const supabase = await createServerClient()

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

    // Get user details
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

    const body = await request.json()
    const { first_name, last_name, phone_number, theme_mode, position_id, sms_auto_send_enabled } = body

    // Build update object with allowed fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    // Profile fields - any authenticated user can update their own
    if (first_name !== undefined) {
      updateData.first_name = first_name
    }
    if (last_name !== undefined) {
      updateData.last_name = last_name
    }
    if (phone_number !== undefined) {
      updateData.phone_number = phone_number
    }
    if (theme_mode !== undefined) {
      updateData.theme_mode = theme_mode
    }
    if (sms_auto_send_enabled !== undefined) {
      if (sms_auto_send_enabled !== null && typeof sms_auto_send_enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'sms_auto_send_enabled must be null, true, or false' },
          { status: 400 }
        )
      }
      updateData.sms_auto_send_enabled = sms_auto_send_enabled
    }

    // Position update - admin only
    if (position_id !== undefined) {
      const isAdmin = currentUser.role === 'admin'

      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Only admins can update positions' },
          { status: 403 }
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

      updateData.position_id = position_id
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 1) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update the user's profile
    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', currentUser.id)

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully'
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}