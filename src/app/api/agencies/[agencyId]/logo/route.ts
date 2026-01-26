/**
 * Agency Logo Upload API Route
 *
 * Proxies to Django backend for agency logo uploads.
 * Handles multipart form data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agencyId: string }> }
) {
  try {
    const { agencyId } = await params
    const accessToken = await getAccessToken()

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the form data from the request
    const formData = await request.formData()

    // Forward to Django backend
    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/agencies/${agencyId}/logo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    })

    const data = await response.json()

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error uploading logo:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
