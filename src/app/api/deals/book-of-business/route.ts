// API ROUTE: /api/deals/book-of-business
// Proxies to backend API for book of business view

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/deals/book-of-business/')
}
