import { NextRequest, NextResponse } from 'next/server'
import { getApiBaseUrl } from '@/lib/api-config'

/**
 * POST /api/nipr/acquire-job
 * Acquire a NIPR job for processing (used by automation workers).
 * Uses X-Cron-Secret header for authentication.
 */
export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    if (!cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const apiUrl = getApiBaseUrl()

    const response = await fetch(`${apiUrl}/api/nipr/acquire-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': cronSecret,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[API/NIPR/ACQUIRE-JOB] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
