import { NextResponse } from 'next/server'
import camelcaseKeys from 'camelcase-keys'
import { getSession } from '@/lib/session'
import { getApiBaseUrl, authEndpoints } from '@/lib/api-config'

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ authenticated: false })
    }

    // Fetch fresh user data from Django backend
    const response = await fetch(`${getApiBaseUrl()}${authEndpoints.session}`, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      // Token might be expired or invalid
      return NextResponse.json({ authenticated: false })
    }

    const data = await response.json()
    return NextResponse.json(camelcaseKeys(data, { deep: true }))
  } catch (error) {
    console.error('[API/auth/session] Error:', error)
    return NextResponse.json({ authenticated: false })
  }
}
