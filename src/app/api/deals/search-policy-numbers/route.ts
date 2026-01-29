// API ROUTE: /api/deals/search-policy-numbers
// Proxies to Django backend for searching policy numbers in filter dropdown

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/deals/search-policy-numbers/')
}

