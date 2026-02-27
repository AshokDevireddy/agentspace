/**
 * User Profile API Route
 *
 * Proxies to Django backend for user profile operations.
 * Reads authentication from httpOnly session cookie.
 * Unwraps the {success, data} envelope from Django before returning.
 */

import { NextResponse } from 'next/server'
import { proxyToBackend, proxyPut } from '@/lib/api-proxy'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const response = await proxyToBackend(request, '/api/user/profile', {
    method: 'GET',
    searchParams,
  })

  const body = await response.json()
  // Unwrap {success, data} envelope from Django
  const unwrapped = body?.success && body?.data ? body.data : body
  return NextResponse.json(unwrapped, { status: response.status })
}

export async function PUT(request: Request) {
  return proxyPut(request, '/api/user/profile')
}
