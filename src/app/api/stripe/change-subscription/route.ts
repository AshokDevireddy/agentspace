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
    const response = await fetch(`${apiUrl}/api/webhooks/stripe/change-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Origin': origin,
      },
      body: JSON.stringify({
        new_tier: body.newTier,
        coupon_code: body.couponCode || null,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to change subscription' },
        { status: response.status }
      )
    }

    // Map Django response to frontend expected format
    const result: Record<string, unknown> = {
      success: true,
    }

    if (data.status === 'upgraded') {
      result.message = `Upgraded to ${data.new_tier} tier successfully.`
      result.newTier = data.new_tier
      result.immediate = true
    } else if (data.status === 'scheduled') {
      result.message = `Downgrade to ${data.new_tier} tier scheduled.`
      result.scheduledTier = data.new_tier
      result.effectiveDate = data.effective_date
      result.immediate = false
    } else if (data.status === 'checkout_required') {
      result.checkoutUrl = data.checkout_url
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error changing subscription:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
