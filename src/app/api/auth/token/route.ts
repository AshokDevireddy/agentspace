import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/session'

/**
 * GET /api/auth/token
 *
 * Returns the access token from the Django session cookie.
 * Used by client components that need Bearer token authentication.
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

    return NextResponse.json({ accessToken })
  } catch (error) {
    console.error('[API/auth/token] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to retrieve token' },
      { status: 500 }
    )
  }
}
