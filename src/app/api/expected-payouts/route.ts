// API ROUTE: /api/expected-payouts
// Proxies to Django backend for expected commission payouts

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/expected-payouts/')
}
