import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { clientId, email } = body

    // Need either clientId or email
    if (!clientId && !email) {
      return NextResponse.json({ error: 'Client ID or email is required' }, { status: 400 })
    }

    // Get the authenticated user
    const supabase = await createServerClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's data including agency_id
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('id, agency_id')
      .eq('auth_user_id', authUser.id)
      .single()

    if (currentUserError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create Supabase admin client
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

    // Get the client to resend invite to (by ID or email)
    let clientQuery = supabaseAdmin
      .from('users')
      .select('id, auth_user_id, email, first_name, last_name, status, agency_id, role')
      .eq('role', 'client')

    if (clientId) {
      clientQuery = clientQuery.eq('id', clientId)
    } else {
      clientQuery = clientQuery.eq('email', email)
    }

    const { data: client, error: clientError } = await clientQuery.maybeSingle()

    if (clientError) {
      console.error('Client lookup error:', clientError)
      return NextResponse.json({ error: 'Failed to lookup client' }, { status: 500 })
    }

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Verify the client is in the same agency
    if (client.agency_id !== currentUser.agency_id) {
      return NextResponse.json({ error: 'Cannot send invites to clients from other agencies' }, { status: 403 })
    }

    // Verify the client is in 'invited' or 'onboarding' status (for resend)
    if (client.status !== 'invited' && client.status !== 'onboarding') {
      return NextResponse.json({
        error: 'Can only resend invites to clients with invited or onboarding status. For active clients, they already have access.',
        status: client.status
      }, { status: 400 })
    }

    // Verify client has auth_user_id (should exist if they're invited or onboarding)
    if (!client.auth_user_id) {
      return NextResponse.json({
        error: 'Client has no auth account. Please use Send Invite instead.'
      }, { status: 400 })
    }

    // To send a fresh invite email through Supabase, we need to:
    // 1. Set auth_user_id to NULL in users table (to avoid foreign key constraint)
    // 2. Delete the existing auth account
    // 3. Create a new auth account with inviteUserByEmail (sends email)
    // 4. Update the users table with the new auth_user_id

    const oldAuthUserId = client.auth_user_id
    console.log('Unlinking auth account:', oldAuthUserId)

    // Step 1: Set auth_user_id to NULL to avoid foreign key constraint issues
    const { error: unlinkError } = await supabaseAdmin
      .from('users')
      .update({
        auth_user_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', client.id)

    if (unlinkError) {
      console.error('Error unlinking auth user:', unlinkError)
      return NextResponse.json({
        error: 'Failed to prepare resend invitation'
      }, { status: 500 })
    }

    console.log('Auth account unlinked, now deleting from auth:', oldAuthUserId)

    // Step 2: Delete the existing auth account (no foreign key issues now)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(oldAuthUserId)

    if (deleteError) {
      console.error('Error deleting auth user:', deleteError)
      // Try to restore the link if delete fails
      await supabaseAdmin
        .from('users')
        .update({ auth_user_id: oldAuthUserId })
        .eq('id', client.id)

      return NextResponse.json({
        error: 'Failed to delete old auth account. Please try again.'
      }, { status: 500 })
    }

    console.log('Auth account deleted successfully')

    // Create a new auth account and send invite email
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      client.email,
      {
        redirectTo: getRedirectUrl()
      }
    )

    if (inviteError) {
      console.error('Resend invite error:', inviteError)
      return NextResponse.json({
        error: inviteError.message || 'Failed to send invitation'
      }, { status: 400 })
    }

    console.log('New auth account created:', authData.user.id)

    // Update the users table with the new auth_user_id and reset status to 'invited'
    const { error: updateAuthError } = await supabaseAdmin
      .from('users')
      .update({
        auth_user_id: authData.user.id,
        status: 'invited', // Reset status back to invited so they go through the flow again
        updated_at: new Date().toISOString()
      })
      .eq('id', client.id)

    if (updateAuthError) {
      console.error('Error updating auth_user_id:', updateAuthError)
      // Try to delete the newly created auth account to avoid orphans
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id, true)
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError)
      }
      return NextResponse.json({
        error: 'Failed to update user record'
      }, { status: 500 })
    }

    console.log('User record updated with new auth_user_id')

    // Update status back to 'invited' if they were in 'onboarding'
    if (client.status === 'onboarding') {
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          status: 'invited',
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id)

      if (updateError) {
        console.error('Error updating status to invited:', updateError)
        // Don't fail the request, invite was still sent
      }
    }

    return NextResponse.json({
      success: true,
      message: `Invitation resent successfully to ${client.first_name} ${client.last_name}`
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
