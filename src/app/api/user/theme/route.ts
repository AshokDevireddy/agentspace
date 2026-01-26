/**
 * User Theme API Route
 *
 * Proxies to Django backend for theme preference updates.
 * Reads authentication from httpOnly session cookie.
 */

import { NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { theme } = body

  // Validate theme value
  if (theme !== null && !['light', 'dark', 'system'].includes(theme)) {
    return NextResponse.json(
      { error: 'Invalid theme. Must be "light", "dark", "system", or null' },
      { status: 400 }
    )
  }

  // Proxy to profile endpoint with theme_mode field
  return proxyToBackend(request, '/api/user/profile', {
    method: 'PUT',
    body: { theme_mode: theme },
  })
}
