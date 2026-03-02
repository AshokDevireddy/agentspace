import { type NextRequest } from 'next/server'
import { proxyGet, proxyPut, proxyDelete } from '@/lib/proxy-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyGet(request, `/api/agents/${id}/`)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyPut(request, `/api/agents/${id}/`)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyDelete(request, `/api/agents/${id}/`)
}
