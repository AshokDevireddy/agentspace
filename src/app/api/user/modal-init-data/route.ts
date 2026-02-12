// API ROUTE: /api/user/modal-init-data
// Proxies to backend API for add-user modal initialization data
// Returns positions, userPositionLevel, isAdmin, currentUser, downlineAgents

import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/user/modal-init-data/')
}
