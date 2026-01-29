// API ROUTE: /api/deals
// Proxies to Django backend for deals list and creation

import { proxyGetWithParams, proxyPost } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/deals/')
}

export async function POST(request: Request) {
  return proxyPost(request, '/api/deals/')
}
