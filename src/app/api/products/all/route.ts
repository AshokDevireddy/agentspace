// API ROUTE: /api/products/all
// Proxies to backend API for all products in user's agency

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/products/all/')
}
