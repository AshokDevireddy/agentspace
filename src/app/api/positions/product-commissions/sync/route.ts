// API ROUTE: /api/positions/product-commissions/sync
// Proxies to backend API for syncing missing commission entries

import { proxyPost } from '@/lib/api-proxy'

export async function POST(request: Request) {
  return proxyPost(request, '/api/positions/product-commissions/sync/')
}
