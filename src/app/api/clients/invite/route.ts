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

    // Check if client already exists
    const { data: existingClient } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .eq('role', 'client')
      .maybeSingle()

    if (existingClient) {
      return NextResponse.json({
        success: true,
        userId: existingClient.id,
        message: 'Client already exists',
        alreadyExists: true
      })
    }

    // Check pending invites
    const { data: pendingInvite } = await supabase
      .from('pending_invite')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (pendingInvite) {
      return NextResponse.json({
        success: true,
        userId: pendingInvite.id,
        message: 'Invitation already sent',
        alreadyExists: true
      })
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

    // 2. Create pending_invite record with agency_id
    const { error: dbError } = await supabase
      .from('pending_invite')
      .insert([{
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber || null,
        role: 'client',
        perm_level: 'client',
        is_admin: false,
        is_active: true,
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
      message: 'Client invited successfully',
      alreadyExists: false
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

