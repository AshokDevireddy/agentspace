// API ROUTE: /api/agents/invite
// Proxies to Django backend endpoint POST /api/agents/invite/

import { proxyPost } from '@/lib/api-proxy'

export async function POST(request: Request) {
  return proxyPost(request, '/api/agents/invite/')
}
