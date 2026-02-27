/**
 * NIPR Process Queue - Proxy to Django
 * POST /api/nipr/process
 *
 * Triggers processing of next pending NIPR job.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getApiBaseUrl } from '@/lib/api-config'

export async function POST(request: NextRequest) {
  try {
    const apiUrl = getApiBaseUrl()
    const cronSecret = process.env.CRON_SECRET || ''

    const response = await fetch(`${apiUrl}/api/nipr/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': cronSecret,
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('NIPR process queue proxy error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process queue' },
      { status: 500 }
    )
  }
}
