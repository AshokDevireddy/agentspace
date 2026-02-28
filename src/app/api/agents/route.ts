import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import camelcaseKeys from 'camelcase-keys'
import { getApiBaseUrl } from '@/lib/api-config'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    let token = cookieStore.get('access_token')?.value

    // Fallback to Authorization header (client sends token before cookie is available)
    if (!token) {
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7)
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Forward query params to Django
    const { searchParams } = new URL(request.url)
    const backendUrl = new URL(`${getApiBaseUrl()}/api/agents/`)
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
    console.error('[API /api/agents] Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
