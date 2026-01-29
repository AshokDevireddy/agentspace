// API ROUTE: /api/deals/[id]
// Proxies to Django backend for deal detail, update, and delete operations

import { proxyGetWithParams, proxyPut, proxyPatch, proxyDelete } from '@/lib/api-proxy'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyGetWithParams(request, `/api/deals/${id}/`)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyPut(request, `/api/deals/${id}/`)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyPatch(request, `/api/deals/${id}/`)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyDelete(request, `/api/deals/${id}/`)
}
