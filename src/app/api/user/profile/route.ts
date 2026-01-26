/**
 * User Profile API Route
 *
 * Proxies to Django backend for user profile operations.
 * Reads authentication from httpOnly session cookie.
 */

import { proxyGetWithParams, proxyPut } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/user/profile')
}

export async function PUT(request: Request) {
  return proxyPut(request, '/api/user/profile')
}
