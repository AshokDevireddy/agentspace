// API ROUTE: /api/agents/without-positions
// Proxies to backend API for agents without positions assigned

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/agents/without-positions/')
}
