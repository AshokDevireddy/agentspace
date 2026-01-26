// API ROUTE: /api/positions
// Proxies to backend API for positions list and creation

import { proxyGetWithParams, proxyPost } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/positions/')
}

export async function POST(request: Request) {
  return proxyPost(request, '/api/positions/')
}
