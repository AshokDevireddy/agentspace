// API ROUTE: /api/users
// This endpoint fetches user information by ID, primarily for getting agent names
// Proxies to Django backend endpoint GET /api/user/{id}/

import { NextResponse } from 'next/server'
import { getApiBaseUrl } from '@/lib/api-config'
import { getAccessToken } from '@/lib/session'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({
        error: 'Missing user ID',
        detail: 'User ID is required'
      }, { status: 400 })
    }

    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/user/${userId}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(errorData, { status: response.status })
    }

    const user = await response.json()

    // Transform to expected format for frontend
    return NextResponse.json({
      id: user.id,
      name: `${user.last_name || ''}, ${user.first_name || ''}`.trim() || 'Unknown'
    })

  } catch (error) {
    console.error('API Error in users:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching user'
    }, { status: 500 })
  }
}
