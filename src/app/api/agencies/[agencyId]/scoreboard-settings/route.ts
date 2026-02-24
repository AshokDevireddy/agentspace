// API ROUTE: /api/agencies/[agencyId]/scoreboard-settings
// Proxies to Django backend for agency scoreboard settings

import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agencyId: string }> }
) {
  const { agencyId } = await params
  return proxyToBackend(request, `/api/agencies/${agencyId}/scoreboard-settings`)
}
