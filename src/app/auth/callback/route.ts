import { createAdminClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { getApiBaseUrl, authEndpoints } from '@/lib/api-config'
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
  const next = requestUrl.searchParams.get('next') // Custom redirect after auth
  const agencyId = requestUrl.searchParams.get('agency_id') // For white-label redirect

  // SECURITY FIX: Reduced logging to prevent token exposure in logs
  // Only log non-sensitive information for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('Auth callback received:', {
      hasToken: !!token,
      hasTokenHash: !!tokenHash,
      type,
      hasCode: !!code,
      error: error || null,
      next: next || null,
    })
  }

  // Handle error from auth provider
  if (error) {
    console.error('Auth callback error:', error, errorDescription)
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  const supabase = createAdminClient()

  // Check if there's already a Django session
  const session = await getSession()
  console.log('Existing session check:', { hasSession: !!session })

  // Handle invite token (from email invite links)
  if (type === 'invite' && (token || tokenHash)) {
    console.log('Processing invite token')

    try {
      // Verify invite token via Django API
      const verifyResponse = await fetch(`${getApiBaseUrl()}${authEndpoints.verifyInvite}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token_hash: tokenHash || token,
          type: 'invite'
        }),
      })

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json().catch(() => ({}))
        console.error('Error verifying invite token:', errorData)
        return NextResponse.redirect(
          `${requestUrl.origin}/login#error=access_denied&error_description=${encodeURIComponent(errorData.message || 'Invalid invitation link')}`
        )
      }

      const verifyData = await verifyResponse.json()
      const authUserId = verifyData.auth_user_id || verifyData.user?.auth_user_id

      if (!authUserId) {
        console.error('No auth user ID from verify response')
        return NextResponse.redirect(`${requestUrl.origin}/login#error=auth_failed&error_description=${encodeURIComponent('Failed to authenticate user')}`)
      }

      // Get user profile to determine where to route them
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('id, role, status')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      if (profileError || !userProfile) {
        console.error('User profile not found:', profileError)
        return NextResponse.redirect(`${requestUrl.origin}/login#error=profile_not_found&error_description=${encodeURIComponent('Account not found')}`)
      }

      // Handle user based on their status
      return await routeUserByProfile(requestUrl.origin, userProfile, supabase)
    } catch (err) {
      console.error('Error in invite verification:', err)
      return NextResponse.redirect(
        `${requestUrl.origin}/login#error=auth_failed&error_description=${encodeURIComponent('Failed to verify invitation')}`
      )
    }
  }

  // If we have a code, exchange it for a session (OAuth/PKCE flow via Django)
  if (code) {
    try {
      // Exchange code via Django API
      const exchangeResponse = await fetch(`${getApiBaseUrl()}/api/auth/exchange-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })

      if (!exchangeResponse.ok) {
        const errorData = await exchangeResponse.json().catch(() => ({}))
        console.error('Error exchanging code for session:', errorData)
        return NextResponse.redirect(
          `${requestUrl.origin}/login?error=${encodeURIComponent(errorData.message || 'Authentication failed')}`
        )
      }

      const exchangeData = await exchangeResponse.json()
      const authUserId = exchangeData.auth_user_id || exchangeData.user?.auth_user_id

      if (!authUserId) {
        console.error('No auth user ID from exchange response')
        return NextResponse.redirect(`${requestUrl.origin}/login`)
      }

      // If 'next' parameter is specified (e.g., for password recovery), redirect there
      if (next === '/forgot-password') {
        console.log('Password recovery flow - redirecting to forgot-password')
        const redirectUrl = agencyId
          ? `${requestUrl.origin}/forgot-password?agency_id=${agencyId}`
          : `${requestUrl.origin}/forgot-password`
        return NextResponse.redirect(redirectUrl)
      }

      // Get user profile to determine where to route them
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('id, role, status')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      if (profileError || !userProfile) {
        console.error('User profile not found:', profileError)
        return NextResponse.redirect(`${requestUrl.origin}/login?error=profile-not-found`)
      }

      return await routeUserByProfile(requestUrl.origin, userProfile, supabase)
    } catch (err) {
      console.error('Error in code exchange:', err)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`)
    }
  }

  // No token or code provided - check if session was already established
  if (session) {
    console.log('No params but session exists, routing user:', session.userId)

    // Get user profile to determine where to route them
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, role, status')
      .eq('id', session.userId)
      .maybeSingle()

    if (profileError || !userProfile) {
      console.error('User profile not found:', profileError)
      return NextResponse.redirect(`${requestUrl.origin}/login#error=profile_not_found&error_description=${encodeURIComponent('Account not found')}`)
    }

    console.log('User profile:', userProfile)
    return await routeUserByProfile(requestUrl.origin, userProfile, supabase)
  }

  // No session and no parameters
  console.error('No code/token provided and no existing session in auth callback')
  return NextResponse.redirect(`${requestUrl.origin}/login`)
}

// Helper function to route user based on their profile status
async function routeUserByProfile(
  origin: string,
  userProfile: { id: string; role: string; status: string },
  supabase: ReturnType<typeof createAdminClient>
) {
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

    return NextResponse.redirect(`${origin}/setup-account`)
  }

  if (userProfile.status === 'onboarding') {
    return NextResponse.redirect(`${origin}/setup-account`)
  }

  if (userProfile.status === 'active') {
    if (userProfile.role === 'client') {
      return NextResponse.redirect(`${origin}/client/dashboard`)
    } else {
      return NextResponse.redirect(`${origin}/`)
    }
  }

  // Handle inactive or other statuses
  console.error('User has invalid status:', userProfile.status)
  return NextResponse.redirect(
    `${origin}/login#error=invalid_status&error_description=${encodeURIComponent('Account is not accessible')}`
  )
}
