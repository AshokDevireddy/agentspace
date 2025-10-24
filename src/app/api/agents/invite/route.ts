import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, firstName, lastName, phoneNumber, permissionLevel, uplineAgentId, preInviteUserId } = body

    console.log('Inviting agent with upline_id:', uplineAgentId, 'preInviteUserId:', preInviteUserId)

    // Get the authenticated user
    const supabase = await createServerClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's data including agency_id
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('id, agency_id, is_admin, perm_level')
      .eq('auth_user_id', authUser.id)
      .single()

    if (currentUserError || !currentUser) {
      console.error('Current user error:', currentUserError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!currentUser.agency_id) {
      return NextResponse.json({ error: 'User does not belong to an agency' }, { status: 400 })
    }

    console.log('Inviting user with agency_id:', currentUser.agency_id)

    // Create Supabase admin client with service role key
    const supabaseAdmin = createAdminClient()

    // Determine role and admin status based on permission level
    const isAdmin = permissionLevel === 'admin'
    const role = permissionLevel === 'admin' ? 'admin' : 'agent'

    // If updating a pre-invite user
    if (preInviteUserId) {
      console.log('Updating pre-invite user:', preInviteUserId)

      // Verify the pre-invite user exists and is in pre-invite status
      const { data: preInviteUser, error: preInviteError } = await supabaseAdmin
        .from('users')
        .select('id, status, first_name, last_name, agency_id')
        .eq('id', preInviteUserId)
        .single()

      if (preInviteError || !preInviteUser) {
        return NextResponse.json({ error: 'Pre-invite user not found' }, { status: 404 })
      }

      if (preInviteUser.status !== 'pre-invite') {
        return NextResponse.json({ error: 'User is not in pre-invite status' }, { status: 400 })
      }

      // Verify the pre-invite user is in the same agency
      if (preInviteUser.agency_id !== currentUser.agency_id) {
        return NextResponse.json({ error: 'Cannot update users from other agencies' }, { status: 403 })
      }

      // Check if email is already in use by another user
      if (email) {
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id, status')
          .eq('email', email)
          .neq('id', preInviteUserId)
          .maybeSingle()

        if (existingUser) {
          return NextResponse.json({ error: 'This email is already in use by another user' }, { status: 400 })
        }
      }

      // Create auth user and send invite email
      const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm`
        }
      )

      if (inviteError) {
        console.error('Invite error:', inviteError)
        return NextResponse.json({ error: inviteError.message || 'Failed to send invitation' }, { status: 400 })
      }

      // Update the pre-invite user record with auth info and new data
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          auth_user_id: authData.user.id,
          email,
          phone_number: phoneNumber || null,
          role: role,
          upline_id: uplineAgentId || null,
          perm_level: permissionLevel,
          is_admin: isAdmin,
          status: 'invited',
          updated_at: new Date().toISOString()
        })
        .eq('id', preInviteUserId)

      if (updateError) {
        console.error('Update error:', updateError)
        // Cleanup: try to delete auth user if update fails
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError)
        }
        return NextResponse.json({ error: updateError.message || 'Failed to update user record' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        userId: preInviteUserId,
        message: 'Pre-invite user updated and invitation sent successfully'
      })
    }

    // Creating a new user (original logic)
    // Check if user with this email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, status')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      if (existingUser.status === 'invited') {
        return NextResponse.json({ error: 'An invitation has already been sent to this email' }, { status: 400 })
      }
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
    }

    // 1. Create auth user and send invite email
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm`
      }
    )

    if (inviteError) {
      console.error('Invite error:', inviteError)
      return NextResponse.json({ error: inviteError.message || 'Failed to send invitation' }, { status: 400 })
    }

    // 2. Create user record with status='invited' and agency_id (using admin client to bypass RLS)
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        auth_user_id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber || null,
        role: role,
        upline_id: uplineAgentId || null,
        annual_goal: 0,
        perm_level: permissionLevel,
        is_admin: isAdmin,
        status: 'invited',
        total_prod: 0,
        total_policies_sold: 0,
        start_date: new Date().toISOString().split('T')[0],
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
      message: 'Agent invited successfully'
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

