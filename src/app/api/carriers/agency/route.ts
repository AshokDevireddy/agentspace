// API ROUTE: /api/carriers/agency
// Proxies to backend API for agency-specific carriers

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/carriers/agency/')
}
