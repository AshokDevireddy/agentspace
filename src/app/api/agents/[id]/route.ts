// API ROUTE: /api/agents/[id]
// Proxies to backend API for agent detail and updates

import { proxyGetWithParams, proxyPut } from '@/lib/api-proxy'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyGetWithParams(request, `/api/agents/${id}/`)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyPut(request, `/api/agents/${id}/`)
}
