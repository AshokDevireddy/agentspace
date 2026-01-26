// API ROUTE: /api/dashboard/summary
// Proxies to backend API for dashboard summary data

import { proxyToBackend } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyToBackend(request, '/api/dashboard/summary/')
}
