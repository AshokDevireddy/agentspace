import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const origin = request.headers.get('origin') || 'http://localhost:3000'

    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/webhooks/stripe/create-topup-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        product_key: body.topupProductKey,
        success_url: `${origin}/user/profile?topup_success=true&product=${body.topupProductKey}`,
        cancel_url: `${origin}/user/profile?topup_canceled=true`,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to create top-up session', ...data },
        { status: response.status }
      )
    }

    return NextResponse.json({
      sessionId: data.session_id,
      url: data.url,
    })
  } catch (error) {
    console.error('Error creating top-up session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
