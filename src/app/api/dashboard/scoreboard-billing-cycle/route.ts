// API ROUTE: /api/dashboard/scoreboard-billing-cycle
// Proxies to backend API for scoreboard billing cycle data

import { proxyToBackend } from '@/lib/api-proxy'

export async function GET(request: Request) {
  const url = new URL(request.url)

  // Forward query params to backend
  const startDate = url.searchParams.get('start_date')
  const endDate = url.searchParams.get('end_date')
  const scope = url.searchParams.get('scope')
  const dateMode = url.searchParams.get('date_mode')

  const backendUrl = new URL('/api/dashboard/scoreboard-billing-cycle/', 'http://localhost')
  if (startDate) backendUrl.searchParams.set('start_date', startDate)
  if (endDate) backendUrl.searchParams.set('end_date', endDate)
  if (scope) backendUrl.searchParams.set('scope', scope)
  if (dateMode) backendUrl.searchParams.set('date_mode', dateMode)

  return proxyToBackend(request, backendUrl.pathname + backendUrl.search)
}
