// API ROUTE: /api/carriers/names
// Proxies to backend API for carrier names dropdown

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/carriers/names/')
}
