// API ROUTE: /api/analytics/downline-distribution
// Proxies to Django backend for downline production distribution data

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/analytics/downline-distribution')
}
