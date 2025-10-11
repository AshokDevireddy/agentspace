import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, firstName, lastName, phoneNumber, annualGoal, permissionLevel, positionId, uplineAgentId } = body

    // Validate required fields
    if (!email || !firstName || !lastName || !permissionLevel) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        detail: 'Email, first name, last name, and permission level are required'
      }, { status: 400 })
    }

    // Validate upline agent ID if provided
    if (uplineAgentId) {
      const admin = createAdminClient()
      const { data: uplineAgent, error: uplineError } = await admin
        .from('users')
        .select('id')
        .eq('id', uplineAgentId)
        .eq('is_active', true)
        .single()

      if (uplineError || !uplineAgent) {
        return NextResponse.json({ 
          error: 'Invalid upline agent',
          detail: 'The selected upline agent does not exist or is not active'
        }, { status: 400 })
      }
    }

    const admin = createAdminClient()

    // Create user via Supabase Auth Admin API and send invite email
    const { data: newUser, error: createUserError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { 
        first_name: firstName, 
        last_name: lastName,
        full_name: `${firstName} ${lastName}`
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`
    })

    if (createUserError) {
      console.error('Error creating user:', createUserError)
      return NextResponse.json({ 
        error: 'Failed to create user',
        detail: createUserError.message 
      }, { status: 400 })
    }

    if (!newUser.user) {
      return NextResponse.json({ 
        error: 'Failed to create user',
        detail: 'No user returned from creation'
      }, { status: 400 })
    }

    console.log("Permission Level:", permissionLevel, permissionLevel?.trim().toLowerCase() === 'admin');
    
    // Insert user data into pending_invite table instead of users table
    const { error: insertError } = await admin
      .from('pending_invite')
      .insert([{
        id: newUser.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        annual_goal: annualGoal ? Number(annualGoal) : 0,
        role: permissionLevel,
        perm_level: permissionLevel,
        total_prod: 0,
        total_policies_sold: 0,
        position_id: positionId, // Use position ID instead of position name
        upline_id: uplineAgentId, // Add upline agent ID
        created_at: new Date().toISOString(),
        is_active: true,
        is_admin: (permissionLevel?.trim().toLowerCase() === 'admin'),
      }])

    if (insertError) {
      console.error('Error inserting user data into pending_invite:', insertError)
      
      // If we fail to insert user data, we should clean up the auth user
      try {
        await admin.auth.admin.deleteUser(newUser.user.id)
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user after insert error:', cleanupError)
      }
      
      return NextResponse.json({ 
        error: 'Failed to save user data',
        detail: insertError.message 
      }, { status: 500 })
    }

    console.log(`Successfully created pending invite for user: ${email} with permission level: ${permissionLevel}`)

    return NextResponse.json({ 
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        first_name: firstName,
        last_name: lastName,
        perm_level: permissionLevel
      },
      message: 'User invitation created successfully and invitation email sent'
    })

  } catch (err) {
    console.error('API Error:', err)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while creating the user invitation'
    }, { status: 500 })
  }
}
