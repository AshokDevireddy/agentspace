/**
 * NIPR Queue Cron - Proxy to Django
 * GET /api/cron/nipr-queue
 *
 * Thin wrapper for Vercel Cron that forwards to Django process-queue endpoint.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getApiBaseUrl } from '@/lib/api-config'
import { verifyCronRequest } from '@/lib/cron-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = verifyCronRequest(request)
    if (!authResult.authorized) {
      return authResult.response
    }

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
    console.error('NIPR queue cron proxy error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process NIPR queue' },
      { status: 500 }
    )
  }
}
