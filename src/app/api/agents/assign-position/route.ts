import { type NextRequest } from 'next/server'
import { proxyPost } from '@/lib/proxy-helpers'

export async function POST(request: NextRequest) {
  return proxyPost(request, '/api/agents/assign-position/')
}
