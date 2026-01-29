// API ROUTE: /api/deals/search-clients
// Proxies to Django backend for searching clients in filter dropdown

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/deals/search-clients/')
}

