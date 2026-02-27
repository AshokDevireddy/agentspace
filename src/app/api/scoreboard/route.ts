// API ROUTE: /api/scoreboard
// Proxies to backend API for scoreboard/leaderboard data.
// Unwraps the {success, data} envelope from Django and maps field names
// to the ScoreboardData shape expected by the frontend.

import { NextResponse } from 'next/server'
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

  const response = await proxyToBackend(request, backendUrl.pathname + backendUrl.search)
  const body = await response.json()

  // Unwrap {success, data} envelope from Django
  const raw = body?.success && body?.data ? body.data : body

  // Map leaderboard entries to the ScoreboardData shape the frontend expects
  const entries = (raw.leaderboard ?? []).map((entry: {
    rank: number
    agentId: string
    name: string
    total: number
    dealCount: number
    position?: string | null
  }) => ({
    rank: entry.rank,
    agentId: entry.agentId,
    agentName: entry.name,
    production: String(entry.total),
    dealsCount: entry.dealCount,
    position: entry.position ?? null,
  }))

  const scoreboardData = {
    entries,
    userRank: raw.userRank ?? null,
    userProduction: raw.userProduction != null ? String(raw.userProduction) : null,
  }

  return NextResponse.json(scoreboardData, { status: response.status })
}
