// API ROUTE: /api/users/me
// Proxies to Django backend for current user profile data

import { proxyToBackend } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyToBackend(request, '/api/user/profile/')
}
