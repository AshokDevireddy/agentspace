import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'

/**
 * GET /api/ingest/staging-summary
 * Get summary of staging records for an ingest job.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Forward query params
    const searchParams = request.nextUrl.searchParams.toString()
    const apiUrl = getApiBaseUrl()

    const response = await fetch(
      `${apiUrl}/api/ingest/staging-summary${searchParams ? `?${searchParams}` : ''}`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    )

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[API/INGEST/STAGING-SUMMARY] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
