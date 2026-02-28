import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import camelcaseKeys from 'camelcase-keys'
import snakecaseKeys from 'snakecase-keys'
import { getApiBaseUrl } from '@/lib/api-config'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    let token = cookieStore.get('access_token')?.value

    if (!token) {
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7)
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const snakeBody = snakecaseKeys(body, { deep: true })

    const response = await fetch(`${getApiBaseUrl()}/api/agents/invite/`, {
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
    console.error('[API /api/agents/invite] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
