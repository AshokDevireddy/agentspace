import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, firstName, lastName, phoneNumber, agencyName } = body

    // Validate required fields
    if (!email || !firstName || !lastName || !agencyName) {
      return NextResponse.json({
        error: 'Missing required fields'
      }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Check if user already exists
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

    // 2. Create agency
    const { data: agencyData, error: agencyError } = await supabaseAdmin
      .from('agencies')
      .insert([{
        name: agencyName,
        code: agencyName.toLowerCase().replace(/\s+/g, '-'),
        display_name: agencyName,
        is_active: true,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single()

    if (agencyError) {
      console.error('Error creating agency:', agencyError)
      return NextResponse.json({ error: 'Failed to create agency' }, { status: 500 })
    }

    // 3. Create auth user and send invite email
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`
      }
    )

    if (inviteError) {
      console.error('Invite error:', inviteError)
      // Cleanup: delete agency if user creation fails
      await supabaseAdmin.from('agencies').delete().eq('id', agencyData.id)
      return NextResponse.json({ error: inviteError.message || 'Failed to send invitation' }, { status: 400 })
    }

    // 4. Create user record with status='invited' and agency_id
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        auth_user_id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber || null,
        role: 'admin',
        upline_id: null,
        annual_goal: 0,
        perm_level: 'admin',
        is_admin: true,
        status: 'invited',
        total_prod: 0,
        total_policies_sold: 0,
        start_date: new Date().toISOString().split('T')[0],
        agency_id: agencyData.id,
        theme_mode: 'system'
      }])

    if (dbError) {
      console.error('Database error:', dbError)
      // Cleanup: try to delete auth user and agency if database insert fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        await supabaseAdmin.from('agencies').delete().eq('id', agencyData.id)
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError)
      }
      return NextResponse.json({ error: dbError.message || 'Failed to create user record' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Registration successful! Please check your email to confirm your account.'
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

