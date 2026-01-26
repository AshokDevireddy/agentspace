// API ROUTE: /api/agents/assign-position
// Proxies to backend API for assigning positions to agents

import { proxyPost } from '@/lib/api-proxy'

export async function POST(request: Request) {
  return proxyPost(request, '/api/agents/assign-position/')
}
