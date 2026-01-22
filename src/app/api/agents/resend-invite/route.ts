import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { agentId } = body

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 })
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
      .select('id, agency_id, is_admin, perm_level')
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
        return `${protocol}://${agencyData.whitelabel_domain}/auth/confirm`
      }
      return `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm`
    }

    // Get the agent to resend invite to
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('users')
      .select('id, auth_user_id, email, first_name, last_name, status, agency_id, role')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Verify the agent is in the same agency
    if (agent.agency_id !== currentUser.agency_id) {
      return NextResponse.json({ error: 'Cannot resend invites to agents from other agencies' }, { status: 403 })
    }

    // Verify the agent is in 'invited' or 'onboarding' status
    if (agent.status !== 'invited' && agent.status !== 'onboarding') {
      return NextResponse.json({ error: 'Can only resend invites to agents with invited or onboarding status' }, { status: 400 })
    }

    // Verify the agent has role of 'agent' or 'admin'
    if (agent.role !== 'agent' && agent.role !== 'admin') {
      return NextResponse.json({ error: 'Can only resend invites to agents and admins' }, { status: 400 })
    }

    // 1. First, unlink the old auth account from the user record
    if (agent.auth_user_id) {
      console.log('Unlinking auth account:', agent.auth_user_id)
      const { error: unlinkError } = await supabaseAdmin
        .from('users')
        .update({ auth_user_id: null })
        .eq('id', agent.id)

      if (unlinkError) {
        console.error('Error unlinking auth account:', unlinkError)
        return NextResponse.json({
          error: 'Failed to prepare account for new invite',
          details: unlinkError.message
        }, { status: 500 })
      }

      console.log('Auth account unlinked, now deleting from auth:', agent.auth_user_id)

      // 2. Delete the old auth account
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(agent.auth_user_id)

      if (deleteError) {
        console.error('Error deleting old auth account:', deleteError)
        // Continue anyway - the auth account might already be deleted
      }
    }

    console.log('Auth account deleted successfully')

    // 3. Create a new auth account and send invite email
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      agent.email,
      {
        redirectTo: getRedirectUrl()
      }
    )

    if (inviteError) {
      console.error('Resend invite error:', inviteError)
      return NextResponse.json({
        error: inviteError.message || 'Failed to send invitation',
        code: inviteError.code
      }, { status: 400 })
    }

    // 4. Update the user record with the new auth_user_id and reset status to 'invited'
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        auth_user_id: authData.user.id,
        status: 'invited', // Reset status back to invited so they go through the flow again
        updated_at: new Date().toISOString()
      })
      .eq('id', agent.id)

    if (updateError) {
      console.error('Error updating user with new auth_user_id:', updateError)
      // Cleanup: try to delete the newly created auth user
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError)
      }
      return NextResponse.json({
        error: 'Failed to link new auth account',
        details: updateError.message
      }, { status: 500 })
    }

    console.log('User record updated with new auth_user_id')

    return NextResponse.json({
      success: true,
      message: `Invitation resent successfully to ${agent.first_name} ${agent.last_name}`
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
