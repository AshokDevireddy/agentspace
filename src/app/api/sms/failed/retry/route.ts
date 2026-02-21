import { NextRequest, NextResponse } from 'next/server'

const DJANGO_URL = process.env.DJANGO_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const cookie = request.headers.get('cookie') || ''
    const body = await request.json()

    const response = await fetch(`${DJANGO_URL}/api/sms/failed/retry/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || data.message || 'Failed to retry messages' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[SMS Retry] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
