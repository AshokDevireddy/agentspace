import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token = requestUrl.searchParams.get('token')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  console.log('=== Auth Callback Debug ===')
  console.log('Full URL:', requestUrl.href)
  console.log('Search params:', requestUrl.searchParams.toString())
  console.log('Parsed params:', { token: !!token, tokenHash: !!tokenHash, type, code: !!code, error })
  console.log('========================')

  // Handle error from Supabase
  if (error) {
    console.error('Auth callback error:', error, errorDescription)
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  const supabase = await createServerClient()

  // Check if there's already a session (Supabase may have set it before redirecting)
  const { data: { user: existingUser }, error: sessionError } = await supabase.auth.getUser()
  console.log('Existing session check:', {
    hasUser: !!existingUser,
    userId: existingUser?.id,
    error: sessionError?.message
  })

  // Handle invite token (from email invite links)
  if (type === 'invite' && token) {
    console.log('Processing invite token')

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash || token,
      type: 'invite'
    })

    if (verifyError) {
      console.error('Error verifying invite token:', verifyError)
      return NextResponse.redirect(
        `${requestUrl.origin}/login#error=access_denied&error_description=${encodeURIComponent(verifyError.message)}`
      )
    }

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('Error getting user after invite verification:', userError)
      return NextResponse.redirect(`${requestUrl.origin}/login#error=auth_failed&error_description=${encodeURIComponent('Failed to authenticate user')}`)
    }

    // Get user profile to determine where to route them
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, role, status')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (profileError || !userProfile) {
      console.error('User profile not found:', profileError)
      return NextResponse.redirect(`${requestUrl.origin}/login#error=profile_not_found&error_description=${encodeURIComponent('Account not found')}`)
    }

    // Handle user based on their status
    if (userProfile.status === 'invited') {
      // First time clicking invite link - transition to onboarding
      console.log('Transitioning user from invited to onboarding')
      const { error: updateError } = await supabase
        .from('users')
        .update({ status: 'onboarding', updated_at: new Date().toISOString() })
        .eq('id', userProfile.id)

      if (updateError) {
        console.error('Error updating user status:', updateError)
        // Continue anyway, they can still proceed to setup
      }

      return NextResponse.redirect(`${requestUrl.origin}/setup-account`)
    }

    if (userProfile.status === 'onboarding') {
      return NextResponse.redirect(`${requestUrl.origin}/setup-account`)
    }

    if (userProfile.status === 'active') {
      if (userProfile.role === 'client') {
        return NextResponse.redirect(`${requestUrl.origin}/client/dashboard`)
      } else {
        return NextResponse.redirect(`${requestUrl.origin}/`)
      }
    }

    // Handle inactive or other statuses
    console.error('User has invalid status:', userProfile.status)
    return NextResponse.redirect(
      `${requestUrl.origin}/login#error=invalid_status&error_description=${encodeURIComponent('Account is not accessible')}`
    )
  }

  // If we have a code, exchange it for a session (OAuth flow)
  if (code) {
    const supabase = await createServerClient()

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError)
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=${encodeURIComponent(exchangeError.message)}`
      )
    }

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('Error getting user after exchange:', userError)
      return NextResponse.redirect(`${requestUrl.origin}/login`)
    }

    // Get user profile to determine where to route them
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, role, status')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (profileError || !userProfile) {
      console.error('User profile not found:', profileError)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=profile-not-found`)
    }

    // Handle user based on their status
    if (userProfile.status === 'invited') {
      // First time clicking invite link - transition to onboarding
      console.log('Transitioning user from invited to onboarding')
      const { error: updateError } = await supabase
        .from('users')
        .update({ status: 'onboarding', updated_at: new Date().toISOString() })
        .eq('id', userProfile.id)

      if (updateError) {
        console.error('Error updating user status:', updateError)
        // Continue anyway, they can still proceed to setup
      }

      return NextResponse.redirect(`${requestUrl.origin}/setup-account`)
    }

    if (userProfile.status === 'onboarding') {
      // User clicked link again but hasn't finished onboarding
      return NextResponse.redirect(`${requestUrl.origin}/setup-account`)
    }

    if (userProfile.status === 'active') {
      // User already set up, route to appropriate dashboard
      if (userProfile.role === 'client') {
        return NextResponse.redirect(`${requestUrl.origin}/client/dashboard`)
      } else {
        return NextResponse.redirect(`${requestUrl.origin}/`)
      }
    }

    // Handle inactive or other statuses
    console.error('User has invalid status:', userProfile.status)
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=${encodeURIComponent('Account is not accessible')}`
    )
  }

  // No token or code provided - check if session was already established by Supabase
  if (existingUser) {
    console.log('No params but session exists, routing user:', existingUser.id)

    // Get user profile to determine where to route them
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, role, status')
      .eq('auth_user_id', existingUser.id)
      .maybeSingle()

    if (profileError || !userProfile) {
      console.error('User profile not found:', profileError)
      return NextResponse.redirect(`${requestUrl.origin}/login#error=profile_not_found&error_description=${encodeURIComponent('Account not found')}`)
    }

    console.log('User profile:', userProfile)

    // Handle user based on their status
    if (userProfile.status === 'invited') {
      // First time clicking invite link - transition to onboarding
      console.log('Transitioning user from invited to onboarding')
      const { error: updateError } = await supabase
        .from('users')
        .update({ status: 'onboarding', updated_at: new Date().toISOString() })
        .eq('id', userProfile.id)

      if (updateError) {
        console.error('Error updating user status:', updateError)
        // Continue anyway, they can still proceed to setup
      }

      return NextResponse.redirect(`${requestUrl.origin}/setup-account`)
    }

    if (userProfile.status === 'onboarding') {
      return NextResponse.redirect(`${requestUrl.origin}/setup-account`)
    }

    if (userProfile.status === 'active') {
      if (userProfile.role === 'client') {
        return NextResponse.redirect(`${requestUrl.origin}/client/dashboard`)
      } else {
        return NextResponse.redirect(`${requestUrl.origin}/`)
      }
    }

    // Handle inactive or other statuses
    console.error('User has invalid status:', userProfile.status)
    return NextResponse.redirect(
      `${requestUrl.origin}/login#error=invalid_status&error_description=${encodeURIComponent('Account is not accessible')}`
    )
  }

  // No session and no parameters
  console.error('No code/token provided and no existing session in auth callback')
  return NextResponse.redirect(`${requestUrl.origin}/login`)
}
