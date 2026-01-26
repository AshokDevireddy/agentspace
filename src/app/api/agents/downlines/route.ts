// API ROUTE: /api/agents/downlines
// Proxies to backend API for agent downlines

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/agents/downlines/')
}
