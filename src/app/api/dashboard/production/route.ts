// API ROUTE: /api/dashboard/production
// Proxies to backend API for production data

import { proxyToBackend } from '@/lib/api-proxy'

export async function GET(request: Request) {
  const url = new URL(request.url)

  // Forward query params to backend
  const agentIds = url.searchParams.get('agent_ids')
  const startDate = url.searchParams.get('start_date')
  const endDate = url.searchParams.get('end_date')

  const backendUrl = new URL('/api/dashboard/production/', 'http://localhost')
  if (agentIds) backendUrl.searchParams.set('agent_ids', agentIds)
  if (startDate) backendUrl.searchParams.set('start_date', startDate)
  if (endDate) backendUrl.searchParams.set('end_date', endDate)

  return proxyToBackend(request, backendUrl.pathname + backendUrl.search)
}
