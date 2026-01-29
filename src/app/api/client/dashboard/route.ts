// API ROUTE: /api/client/dashboard
// Proxies to Django backend for client dashboard data

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/client/dashboard')
}
