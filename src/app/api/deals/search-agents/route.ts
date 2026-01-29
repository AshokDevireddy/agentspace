// API ROUTE: /api/deals/search-agents
// Proxies to Django backend for searching agents in filter dropdown

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/deals/search-agents/')
}

