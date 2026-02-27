/**
 * NIPR Upload - Proxy to Django
 * POST /api/nipr/upload
 *
 * Forwards PDF upload to Django for AI analysis.
 */
import { NextRequest } from 'next/server'
import { getAccessToken } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Forward the multipart form data directly to Django
    const formData = await request.formData()
    const apiUrl = getApiBaseUrl()

    const response = await fetch(`${apiUrl}/api/nipr/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    })

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('NIPR upload proxy error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to analyze PDF. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
