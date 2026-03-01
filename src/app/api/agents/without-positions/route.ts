import { NextResponse } from 'next/server'
import camelcaseKeys from 'camelcase-keys'
import { getApiBaseUrl } from '@/lib/api-config'

export async function GET(request: Request) {
  try {
    // Auth: Authorization header (same as main's pattern for this route)
    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Unauthorized',
        detail: 'No valid token provided',
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Forward query params to Django
    const { searchParams } = new URL(request.url)
    const backendUrl = new URL(`${getApiBaseUrl()}/api/agents/without-positions/`)
    searchParams.forEach((value, key) => backendUrl.searchParams.set(key, value))

    const response = await fetch(backendUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Backend error' }))
      return NextResponse.json(error, { status: response.status })
    }

    const data = await response.json()
    const transformed = camelcaseKeys(data, { deep: true })
    return NextResponse.json(transformed)
  } catch (error) {
    console.error('[API /api/agents/without-positions] Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
