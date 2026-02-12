// API ROUTE: /api/users/[id]
// Proxies to backend API for individual user details

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyGetWithParams(request, `/api/users/${id}/`)
}
