// API ROUTE: /api/carriers/with-products
// Proxies to backend API for carriers with their products

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/carriers/with-products/')
}
