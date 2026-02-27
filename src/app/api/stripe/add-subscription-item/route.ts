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

    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/webhooks/stripe/add-subscription-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        price_id: body.priceId,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to add subscription item' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription item added successfully',
    })
  } catch (error) {
    console.error('Error adding subscription item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
