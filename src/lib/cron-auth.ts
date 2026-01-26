import { NextRequest, NextResponse } from 'next/server'

/**
 * Verify that a request is an authorized cron job request.
 *
 * Checks for the presence of CRON_SECRET environment variable and validates
 * the authorization header against it.
 *
 * @param request - The incoming Next.js request
 * @returns Object indicating authorization status, with error response if unauthorized
 */
export function verifyCronRequest(request: NextRequest):
  { authorized: true } | { authorized: false; response: NextResponse } {

  // CRON_SECRET is required for security - must be configured
  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET not configured')
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Server configuration error - CRON_SECRET not set' },
        { status: 500 }
      )
    }
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('Cron authorization failed - invalid or missing token')
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  return { authorized: true }
}
