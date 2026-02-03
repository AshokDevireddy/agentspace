import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Performs a timing-safe comparison of two strings.
 * Prevents timing attacks when comparing secrets.
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do the comparison to maintain constant time behavior
    const dummy = Buffer.from(a)
    timingSafeEqual(dummy, dummy)
    return false
  }
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return timingSafeEqual(bufA, bufB)
}

/**
 * Verify that a request is an authorized cron job request.
 *
 * Checks for the presence of CRON_SECRET environment variable and validates
 * the authorization header against it using timing-safe comparison.
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
  const expectedHeader = `Bearer ${process.env.CRON_SECRET}`

  // Use timing-safe comparison to prevent timing attacks
  if (!authHeader || !timingSafeCompare(authHeader, expectedHeader)) {
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
