// API ROUTE: /api/positions/[id]
// Proxies to backend API for position updates and deletion
// Note: Frontend uses PUT but backend uses PATCH

import { proxyPatch, proxyDelete } from '@/lib/api-proxy'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // Backend uses PATCH for updates
  return proxyPatch(request, `/api/positions/${id}/`)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyDelete(request, `/api/positions/${id}/`)
}
