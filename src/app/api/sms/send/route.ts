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
    const response = await fetch(`${apiUrl}/api/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        conversation_id: body.conversationId || body.conversation_id,
        content: body.message || body.content,
        deal_id: body.dealId || body.deal_id,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to send SMS', ...data },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'SMS sent successfully',
      conversationId: data.conversation_id || body.conversationId,
      messageId: data.message_id,
      overage: data.overage_info || undefined,
    })
  } catch (error) {
    console.error('Send SMS error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send SMS' },
      { status: 500 }
    )
  }
}
