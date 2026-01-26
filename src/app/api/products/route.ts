// API ROUTE: /api/products
// Proxies to backend API for products list and creation

import { proxyGetWithParams, proxyPost } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/products/')
}

export async function POST(request: Request) {
  return proxyPost(request, '/api/products/')
}
