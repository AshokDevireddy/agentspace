// API ROUTE: /api/expected-payouts/debt
// Proxies to Django backend for agent debt calculations

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/expected-payouts/debt')
}
