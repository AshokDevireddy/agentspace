import { NextResponse } from 'next/server'
import camelcaseKeys from 'camelcase-keys'
import snakecaseKeys from 'snakecase-keys'
import { getApiBaseUrl } from '@/lib/api-config'

export async function POST(request: Request) {
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

    const body = await request.json()
    const snakeBody = snakecaseKeys(body, { deep: true })

    const response = await fetch(`${getApiBaseUrl()}/api/agents/assign-position/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snakeBody),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Backend error' }))
      return NextResponse.json(error, { status: response.status })
    }

    const data = await response.json()
    const transformed = camelcaseKeys(data, { deep: true })
    return NextResponse.json(transformed)
  } catch (error) {
    console.error('[API /api/agents/assign-position] Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
