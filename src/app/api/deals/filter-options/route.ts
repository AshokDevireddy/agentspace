// API ROUTE: /api/deals/filter-options
// Proxies to backend API for deal filter options

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/deals/filter-options/')
}
