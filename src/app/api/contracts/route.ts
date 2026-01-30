// API ROUTE: /api/contracts
// Proxies to Django backend endpoint GET /api/contracts/

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/contracts/')
}
