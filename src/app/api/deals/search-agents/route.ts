import { type NextRequest } from 'next/server'
import { proxyGet } from '@/lib/proxy-helpers'

export async function GET(request: NextRequest) {
  return proxyGet(request, '/api/deals/search-agents/')
}
