/**
 * Edit SMS Draft API Route
 *
 * Updates the body of a draft SMS message.
 * Reads authentication from httpOnly session cookie.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { messageId, body: newBody } = body

    if (!messageId) {
      return NextResponse.json(
        { error: 'Message ID is required' },
        { status: 400 }
      )
    }

    if (!newBody || typeof newBody !== 'string' || !newBody.trim()) {
      return NextResponse.json(
        { error: 'Message body is required' },
        { status: 400 }
      )
    }

    // Call Django API to update draft message body
    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/sms/drafts/${messageId}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ body: newBody.trim() }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Error updating draft message:', errorData)

      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Draft message not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: errorData.error || 'Failed to update draft message' },
        { status: response.status }
      )
    }

    const data = await response.json()

    console.log(`✅ Draft message ${messageId} updated`)

    return NextResponse.json({
      success: true,
      message: data.message,
    })
  } catch (error) {
    console.error('Error in edit draft endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
