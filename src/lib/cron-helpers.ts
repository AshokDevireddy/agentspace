/**
 * Shared utilities for cron route handlers.
 *
 * Each cron route validates the CRON_SECRET, then POSTs to the corresponding
 * Django messaging endpoint with X-Cron-Secret authentication.
 */
import { NextRequest, NextResponse } from 'next/server'

const DJANGO_API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Validate the cron secret from the request's Authorization header.
 * Returns an error response if invalid, or null if valid.
 */
export function validateCronSecret(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server configuration error - CRON_SECRET not set' },
      { status: 500 },
    )
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

/**
 * Call a Django messaging run endpoint with X-Cron-Secret authentication.
 */
export async function callDjangoRunEndpoint(
  path: string,
  body?: Record<string, unknown>,
): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET!
  const url = `${DJANGO_API_URL}/api/messaging/run${path}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Cron-Secret': cronSecret,
    },
    body: body ? JSON.stringify(body) : '{}',
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json(
      { error: data.error || 'Django endpoint failed', details: data },
      { status: response.status },
    )
  }

  return NextResponse.json(data)
}
