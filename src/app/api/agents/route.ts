// API ROUTE: /api/agents
// Proxies to backend API for agents list (table or tree view)

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/agents/')
}
