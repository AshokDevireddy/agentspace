// API ROUTE: /api/analytics/split-view
// Proxies to Django backend for analytics split view

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/analytics/split-view')
}
