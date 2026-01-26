// API ROUTE: /api/agents/check-positions
// Proxies to backend API for checking if user and upline have positions assigned

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/agents/check-positions/')
}
