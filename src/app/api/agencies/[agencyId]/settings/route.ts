/**
 * Agency Settings API Route
 *
 * Proxies to Django backend for agency settings operations.
 * Reads authentication from httpOnly session cookie.
 */

import { NextRequest } from 'next/server'
import { proxyToBackend, proxyPatch } from '@/lib/api-proxy'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agencyId: string }> }
) {
  const { agencyId } = await params
  return proxyToBackend(request, `/api/agencies/${agencyId}/settings`)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ agencyId: string }> }
) {
  const { agencyId } = await params
  return proxyPatch(request, `/api/agencies/${agencyId}/settings`)
}
