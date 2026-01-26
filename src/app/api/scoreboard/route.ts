// API ROUTE: /api/scoreboard
// Proxies to backend API for scoreboard/leaderboard data

import { proxyToBackend } from '@/lib/api-proxy'

export async function GET(request: Request) {
  const url = new URL(request.url)

  // Map frontend parameter names to backend
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  // Build backend URL with mapped params
  const backendUrl = new URL('/api/dashboard/scoreboard/', process.env.BACKEND_URL || 'http://localhost:8000')
  if (startDate) backendUrl.searchParams.set('start_date', startDate)
  if (endDate) backendUrl.searchParams.set('end_date', endDate)

  return proxyToBackend(request, backendUrl.pathname + backendUrl.search)
}
