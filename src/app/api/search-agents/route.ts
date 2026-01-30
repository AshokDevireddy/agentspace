// API ROUTE: /api/search-agents
// Proxies to Django backend endpoint GET /api/search-agents/
// Supports search within user's downline hierarchy

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/search-agents/')
}
