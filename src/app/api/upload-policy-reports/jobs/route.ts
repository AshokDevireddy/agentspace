// API ROUTE: /api/upload-policy-reports/jobs
// This endpoint fetches ingest jobs and their files for the user's agency
// Used to display uploaded policy report files in the UI
// Calls Django backend endpoint

import { getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Get authenticated session
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = session.accessToken
    const apiUrl = getApiBaseUrl()

    // Call Django endpoint to get jobs and files
    // Django handles: authentication, agency_id from token, filtering
    const djangoResponse = await fetch(`${apiUrl}/api/ingest/jobs?days=30&limit=50`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!djangoResponse.ok) {
      if (djangoResponse.status === 401) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const errorData = await djangoResponse.json().catch(() => ({}))
      console.error('[jobs] Django error:', djangoResponse.status, errorData)
      return NextResponse.json(
        { error: errorData.error || 'Failed to fetch ingest jobs' },
        { status: djangoResponse.status }
      )
    }

    const data = await djangoResponse.json()

    // Response from Django already has files and jobs in expected format
    return NextResponse.json({
      files: data.files || [],
      jobs: data.jobs || [],
    })

  } catch (error) {
    console.error('API Error in upload-policy-reports/jobs:', error)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        detail: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
