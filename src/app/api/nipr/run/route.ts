/**
 * NIPR Run - Proxy to Django
 * POST /api/nipr/run
 *
 * Creates NIPR job and dispatches browser automation on the backend.
 */
import { NextRequest } from 'next/server'
import { getAccessToken } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()
    const apiUrl = getApiBaseUrl()

    const response = await fetch(`${apiUrl}/api/nipr/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('NIPR run proxy error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'NIPR automation failed. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
