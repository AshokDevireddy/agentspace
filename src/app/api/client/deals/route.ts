// API ROUTE: /api/client/deals
// Proxies to Django backend for client's own deals

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/client/deals')
}
