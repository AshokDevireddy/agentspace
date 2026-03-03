import { getApiBaseUrl, authEndpoints } from '@/lib/api-config'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * OAuth/invite/email-link callback handler.
 *
 * The ONLY remaining Next.js API route. Forwards auth codes/tokens to Django,
 * copies Set-Cookie headers from Django's response, and redirects.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token = requestUrl.searchParams.get('token')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const next = requestUrl.searchParams.get('next')
  const agencyId = requestUrl.searchParams.get('agency_id')

  // Handle error from auth provider
  if (error) {
    console.error('Auth callback error:', error, errorDescription)
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  const apiUrl = getApiBaseUrl()

  // Handle invite token (from email invite links)
  if (type === 'invite' && (token || tokenHash)) {
    try {
      const verifyResponse = await fetch(`${apiUrl}${authEndpoints.verifyInvite}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_hash: tokenHash || token,
          type: 'invite',
        }),
      })

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json().catch(() => ({}))
        return NextResponse.redirect(
          `${requestUrl.origin}/login?error=${encodeURIComponent(errorData.message || 'Invalid invitation link')}`
        )
      }

      const verifyData = await verifyResponse.json()
      const authUserId = verifyData.auth_user_id || verifyData.user?.auth_user_id

      // Forward Set-Cookie headers from Django (access_token + refresh_token cookies)
      const redirectResponse = await routeUserByAuthId(requestUrl.origin, authUserId, apiUrl)
      copySetCookieHeaders(verifyResponse, redirectResponse)
      return redirectResponse
    } catch (err) {
      console.error('Error in invite verification:', err)
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=${encodeURIComponent('Failed to verify invitation')}`
      )
    }
  }

  // If we have a code, exchange it via Django (OAuth/PKCE flow)
  if (code) {
    try {
      const exchangeResponse = await fetch(`${apiUrl}/api/auth/exchange-code/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      if (!exchangeResponse.ok) {
        const errorData = await exchangeResponse.json().catch(() => ({}))
        return NextResponse.redirect(
          `${requestUrl.origin}/login?error=${encodeURIComponent(errorData.message || 'Authentication failed')}`
        )
      }

      const exchangeData = await exchangeResponse.json()
      const authUserId = exchangeData.user?.id

      // Password recovery flow
      if (next === '/forgot-password') {
        const redirectUrl = agencyId
          ? `${requestUrl.origin}/forgot-password?agency_id=${agencyId}`
          : `${requestUrl.origin}/forgot-password`
        const response = NextResponse.redirect(redirectUrl)
        copySetCookieHeaders(exchangeResponse, response)
        return response
      }

      // Normal auth flow — route user based on status
      if (authUserId) {
        const redirectResponse = await routeUserByAuthId(requestUrl.origin, authUserId, apiUrl)
        copySetCookieHeaders(exchangeResponse, redirectResponse)
        return redirectResponse
      }

      // Fallback: redirect to home
      const response = NextResponse.redirect(`${requestUrl.origin}/`)
      copySetCookieHeaders(exchangeResponse, response)
      return response
    } catch (err) {
      console.error('Error in code exchange:', err)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`)
    }
  }

  // Check for existing access_token cookie (user navigated here with a session)
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value

  if (accessToken) {
    try {
      // Decode JWT to get auth_user_id (sub claim) — no verification needed here,
      // Django validates it when we call callback-user
      const parts = accessToken.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]))
        if (payload.sub) {
          return await routeUserByAuthId(requestUrl.origin, payload.sub, apiUrl)
        }
      }
    } catch (err) {
      console.error('Error parsing access token:', err)
    }
  }

  // No session and no parameters
  return NextResponse.redirect(`${requestUrl.origin}/login`)
}

/**
 * Route user based on their auth_user_id via Django callback-user endpoint.
 */
async function routeUserByAuthId(
  origin: string,
  authUserId: string,
  apiUrl: string
): Promise<NextResponse> {
  try {
    const callbackResponse = await fetch(
      `${apiUrl}/api/auth/callback-user/?auth_user_id=${authUserId}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (!callbackResponse.ok) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('Account not found')}`
      )
    }

    const userData = await callbackResponse.json()

    if (!userData.routing) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('Account is not accessible')}`
      )
    }

    return NextResponse.redirect(`${origin}${userData.routing}`)
  } catch (err) {
    console.error('Error routing user:', err)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Failed to route user')}`
    )
  }
}

/**
 * Copy Set-Cookie headers from a Django fetch response onto a NextResponse.
 * This forwards the auth cookies Django set (access_token, refresh_token) to the browser.
 */
function copySetCookieHeaders(source: Response, target: NextResponse) {
  const setCookieHeaders = source.headers.getSetCookie()
  for (const cookie of setCookieHeaders) {
    target.headers.append('Set-Cookie', cookie)
  }
}
