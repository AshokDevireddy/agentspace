import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getDatePartsInTimezone, DEFAULT_TIMEZONE } from '@/lib/timezone'

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
      .select('id, status, auth_user_id, first_name, last_name, phone_number, agency_id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      // If user is already active, don't allow re-registration
      if (existingUser.status === 'active') {
        return NextResponse.json({ error: 'This email is already registered. Please log in.' }, { status: 400 })
      }

      // If user is invited or onboarding, allow resend by recreating auth account
      if (existingUser.status === 'invited' || existingUser.status === 'onboarding') {
        try {
          // Check if any fields need updating
          const needsUpdate =
            existingUser.first_name !== firstName ||
            existingUser.last_name !== lastName ||
            (phoneNumber && existingUser.phone_number !== phoneNumber)

          // Get agency to check if name needs updating
          const { data: agencyData } = await supabaseAdmin
            .from('agencies')
            .select('id, name')
            .eq('id', existingUser.agency_id)
            .single()

          const agencyNeedsUpdate = agencyData && agencyData.name !== agencyName

          // IMPORTANT: Delete old auth account FIRST before creating new one
          // Supabase won't allow creating a new auth user if email already exists
          if (existingUser.auth_user_id) {
            // Set auth_user_id to NULL first
            await supabaseAdmin
              .from('users')
              .update({ auth_user_id: null })
              .eq('id', existingUser.id)

            // Then delete the auth account
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
              existingUser.auth_user_id
            )
            if (deleteError) {
              console.error('Error deleting old auth user:', deleteError)
              return NextResponse.json({ error: 'Failed to delete old auth account' }, { status: 500 })
            }
          }

          // Create new auth user and send fresh invite email
          const { data: newAuthData, error: newInviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            email,
            {
              redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm`
            }
          )

          if (newInviteError) {
            console.error('Error sending new invite:', newInviteError)
            return NextResponse.json({ error: newInviteError.message || 'Failed to send invitation' }, { status: 400 })
          }

          // Update user record with new auth_user_id and reset status to invited
          const updateData: any = {
            auth_user_id: newAuthData.user.id,
            status: 'invited',
            updated_at: new Date().toISOString()
          }

          // Only update fields that have changed
          if (needsUpdate) {
            if (existingUser.first_name !== firstName) updateData.first_name = firstName
            if (existingUser.last_name !== lastName) updateData.last_name = lastName
            if (phoneNumber && existingUser.phone_number !== phoneNumber) updateData.phone_number = phoneNumber
          }

          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update(updateData)
            .eq('id', existingUser.id)

          if (updateError) {
            console.error('Error updating user:', updateError)
            return NextResponse.json({ error: 'Failed to update user record' }, { status: 500 })
          }

          // Update agency name if it changed
          if (agencyNeedsUpdate && agencyData) {
            const { error: agencyUpdateError } = await supabaseAdmin
              .from('agencies')
              .update({
                name: agencyName,
                code: agencyName.toLowerCase().replace(/\s+/g, '-'),
                display_name: agencyName,
                updated_at: new Date().toISOString()
              })
              .eq('id', agencyData.id)

            if (agencyUpdateError) {
              console.error('Error updating agency:', agencyUpdateError)
              // Don't fail the whole request if agency update fails
            }
          }

          return NextResponse.json({
            success: true,
            message: 'New invite sent! Check your email.'
          })
        } catch (error: any) {
          console.error('Error during resend process:', error)
          return NextResponse.json({ error: 'Failed to resend invitation' }, { status: 500 })
        }
      }

      // For any other status, reject
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
    // Use /auth/callback for PKCE flow - it will handle the code exchange
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm`
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
        start_date: getDatePartsInTimezone(DEFAULT_TIMEZONE).isoDate,
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

