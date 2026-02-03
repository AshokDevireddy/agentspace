import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/session'

/**
 * GET /api/auth/token
 *
 * Returns the access token from the Django session cookie.
 * Used by client components that need Bearer token authentication.
 *
 * SECURITY NOTES:
 * - This endpoint exposes the access token to JavaScript
 * - The session cookie is httpOnly, but this endpoint makes the token accessible
 * - This is intentional for client-side API calls but should be rate-limited
 * - Token is short-lived (typically 1 hour) and can be refreshed
 * - Rate limiting is handled at the infrastructure level (Vercel/Cloudflare)
 *
 * Returns 401 if no valid session exists.
 */
export async function GET() {
  try {
    const accessToken = await getAccessToken()

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No valid session' },
        { status: 401 }
      )
    }

    // Return token with security headers to prevent caching
    return NextResponse.json(
      { accessToken },
      {
        headers: {
          // Prevent caching of token responses
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
          'Pragma': 'no-cache',
          // Prevent embedding in iframes (clickjacking protection)
          'X-Frame-Options': 'DENY',
        },
      }
    )
  } catch (error) {
    console.error('[API/auth/token] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to retrieve token' },
      { status: 500 }
    )
  }
}
