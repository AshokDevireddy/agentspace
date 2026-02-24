// API ROUTE: /api/users/by-auth-id/[authUserId]/onboarding
// Proxies to Django backend for user onboarding data

import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ authUserId: string }> }
) {
  const { authUserId } = await params
  return proxyToBackend(request, `/api/users/by-auth-id/${authUserId}/onboarding`)
}
