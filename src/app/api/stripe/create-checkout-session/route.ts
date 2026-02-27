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
    const response = await fetch(`${apiUrl}/api/webhooks/stripe/checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Origin': origin,
      },
      body: JSON.stringify({
        price_id: body.priceId,
        success_url: `${origin}/user/profile?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${origin}/user/profile?canceled=true`,
        coupon_code: body.couponCode || null,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to create checkout session' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      sessionId: data.session_id,
      url: data.url,
    })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
