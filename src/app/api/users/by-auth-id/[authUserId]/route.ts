import { type NextRequest } from 'next/server'
import { proxyGet } from '@/lib/proxy-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ authUserId: string }> },
) {
  const { authUserId } = await params
  return proxyGet(request, `/api/users/by-auth-id/${authUserId}/`)
}
