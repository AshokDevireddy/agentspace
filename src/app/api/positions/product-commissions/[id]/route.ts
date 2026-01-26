// API ROUTE: /api/positions/product-commissions/[id]
// Proxies to backend API for commission updates and deletion

import { proxyPatch, proxyDelete } from '@/lib/api-proxy'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyPatch(request, `/api/positions/product-commissions/${id}/`)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyDelete(request, `/api/positions/product-commissions/${id}/`)
}
