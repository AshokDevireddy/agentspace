import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, firstName, lastName, phoneNumber } = body

    // Get the authenticated user
    const supabase = await createServerClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's data
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('id, agency_id')
      .eq('auth_user_id', authUser.id)
      .single()

    if (currentUserError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create Supabase admin client with service role key
    const supabaseAdmin = createAdminClient()

    // Get agency info for white-label redirect URL
    const { data: agencyData } = await supabaseAdmin
      .from('agencies')
      .select('whitelabel_domain')
      .eq('id', currentUser.agency_id)
      .single()

    // Build redirect URL based on agency's white-label domain
    const getRedirectUrl = () => {
      if (agencyData?.whitelabel_domain) {
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
        return `${protocol}://${agencyData.whitelabel_domain}/login`
      }
      return `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`
    }

    // Check if client already exists (including pre-invite and invited clients)
    const { data: existingClient } = await supabaseAdmin
      .from('users')
      .select('id, email, status, auth_user_id, first_name, last_name')
      .eq('email', email)
      .eq('role', 'client')
      .maybeSingle()

    // Handle pre-invite clients: create auth account and update to invited
    if (existingClient && existingClient.status === 'pre-invite') {
      console.log('Converting pre-invite client to invited:', existingClient.id)

      // 1. Create auth user and send invite email
      const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: getRedirectUrl()
        }
      )

      if (inviteError) {
        console.error('Invite error:', inviteError)
        return NextResponse.json({ error: inviteError.message || 'Failed to send invitation' }, { status: 400 })
      }

      // 2. Update existing user record with auth_user_id and change status to invited
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          auth_user_id: authData.user.id,
          status: 'invited',
          // Update name fields if provided (in case they were edited)
          first_name: firstName || existingClient.first_name,
          last_name: lastName || existingClient.last_name,
          phone_number: phoneNumber || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingClient.id)

      if (updateError) {
        console.error('Update error:', updateError)
        // Cleanup: try to delete auth user if update fails
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError)
        }
        return NextResponse.json({ error: updateError.message || 'Failed to update client record' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        userId: existingClient.id,
        message: 'Client invited successfully',
        alreadyExists: false
      })
    }

    // If client already exists with invited, onboarding, or active status
    if (existingClient) {
      return NextResponse.json({
        success: true,
        userId: existingClient.id,
        message: existingClient.status === 'invited' ? 'Invitation already sent' : 'Client already exists',
        alreadyExists: true,
        status: existingClient.status
      })
    }

    // New client - create auth account and user record
    // 1. Create auth user and send invite email
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: getRedirectUrl()
      }
    )

    if (inviteError) {
      console.error('Invite error:', inviteError)
      return NextResponse.json({ error: inviteError.message || 'Failed to send invitation' }, { status: 400 })
    }

    // 2. Create user record with status='invited' and agency_id
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        auth_user_id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber || null,
        role: 'client',
        perm_level: 'client',
        is_admin: false,
        status: 'invited',
        agency_id: currentUser.agency_id  // Inherit agency from inviter
      }])

    if (dbError) {
      console.error('Database error:', dbError)
      // Cleanup: try to delete auth user if database insert fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError)
      }
      return NextResponse.json({ error: dbError.message || 'Failed to create user record' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      userId: authData.user.id,
      message: 'Client invited successfully',
      alreadyExists: false
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

