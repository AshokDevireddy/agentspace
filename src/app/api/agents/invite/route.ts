import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, firstName, lastName, phoneNumber, permissionLevel, uplineAgentId } = body

    console.log('Inviting agent with upline_id:', uplineAgentId)

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

    // Check if user with this email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
    }

    // Check pending invites
    const { data: pendingInvite } = await supabase
      .from('pending_invite')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (pendingInvite) {
      return NextResponse.json({ error: 'An invitation has already been sent to this email' }, { status: 400 })
    }

    // Create Supabase admin client with service role key
    const supabaseAdmin = createAdminClient()

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

    // Determine role and admin status based on permission level
    const isAdmin = permissionLevel === 'admin'
    const role = permissionLevel === 'admin' ? 'admin' : 'agent'

    // 2. Create pending_invite record with agency_id (using admin client to bypass RLS)
    const { error: dbError } = await supabaseAdmin
      .from('pending_invite')
      .insert([{
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber || null,
        role: role,
        upline_id: uplineAgentId || null,
        annual_goal: 0,
        perm_level: permissionLevel,
        is_admin: isAdmin,
        is_active: true,
        total_prod: 0,
        total_policies_sold: 0,
        agent_number: null,
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
      return NextResponse.json({ error: dbError.message || 'Failed to create invitation record' }, { status: 500 })
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

