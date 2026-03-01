import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import camelcaseKeys from 'camelcase-keys'
import snakecaseKeys from 'snakecase-keys'
import { getApiBaseUrl } from '@/lib/api-config'

async function getToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('access_token')?.value || null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const backendUrl = new URL(`${getApiBaseUrl()}/api/agents/${id}/`)
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
    console.error('[API /api/agents/[id]] GET Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const snakeBody = snakecaseKeys(body, { deep: true })

    const response = await fetch(`${getApiBaseUrl()}/api/agents/${id}/`, {
      method: 'PUT',
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
    console.error('[API /api/agents/[id]] PUT Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const response = await fetch(`${getApiBaseUrl()}/api/agents/${id}/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Backend error' }))
      return NextResponse.json(error, { status: response.status })
    }

    const text = await response.text()
    if (!text) return NextResponse.json({ success: true })

    const data = JSON.parse(text)
    const transformed = camelcaseKeys(data, { deep: true })
    return NextResponse.json(transformed)
  } catch (error) {
    console.error('[API /api/agents/[id]] DELETE Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
