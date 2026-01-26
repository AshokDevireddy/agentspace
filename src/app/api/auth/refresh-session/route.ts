import { NextResponse } from 'next/server'
import { getSession, updateSession, deleteSession } from '@/lib/session'
import { getApiBaseUrl, authEndpoints } from '@/lib/api-config'

interface TokenRefreshResponse {
  refreshed: boolean
  expiresIn?: number
  error?: string
}

/**
 * Checks if the current accessToken is close to expiry and refreshes it if needed.
 * This is called periodically by the client to ensure tokens stay fresh.
 *
 * Returns:
 * - { refreshed: false, expiresIn: number } if token is still valid
 * - { refreshed: true, expiresIn: number } if token was refreshed
 * - { refreshed: false, error: string } if refresh failed (client should redirect to login)
 */
export async function POST(): Promise<NextResponse<TokenRefreshResponse>> {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({
        refreshed: false,
        error: 'No session',
      })
    }

    // Decode the accessToken to check expiry
    const tokenParts = session.accessToken.split('.')
    if (tokenParts.length !== 3) {
      return NextResponse.json({
        refreshed: false,
        error: 'Invalid token format',
      })
    }

    let tokenPayload: { exp?: number }
    try {
      tokenPayload = JSON.parse(atob(tokenParts[1]))
    } catch {
      return NextResponse.json({
        refreshed: false,
        error: 'Failed to parse token',
      })
    }

    if (!tokenPayload.exp) {
      return NextResponse.json({
        refreshed: false,
        error: 'Token has no expiry',
      })
    }

    const expiresIn = tokenPayload.exp * 1000 - Date.now()

    // If token expires in more than 5 minutes, no need to refresh
    if (expiresIn > 5 * 60 * 1000) {
      return NextResponse.json({
        refreshed: false,
        expiresIn: Math.floor(expiresIn / 1000),
      })
    }

    // Token is close to expiry or expired - try to refresh
    const refreshResponse = await fetch(`${getApiBaseUrl()}${authEndpoints.refresh}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    })

    if (!refreshResponse.ok) {
      // Refresh failed - session is invalid
      await deleteSession()
      return NextResponse.json({
        refreshed: false,
        error: 'Refresh failed',
      })
    }

    const refreshData = await refreshResponse.json()

    // Update the session with new tokens
    await updateSession({
      accessToken: refreshData.access_token,
      refreshToken: refreshData.refresh_token,
    })

    return NextResponse.json({
      refreshed: true,
      expiresIn: refreshData.expires_in || 3600,
    })
  } catch (error) {
    console.error('[API/auth/refresh-session] Error:', error)
    return NextResponse.json({
      refreshed: false,
      error: 'Internal error',
    })
  }
}
