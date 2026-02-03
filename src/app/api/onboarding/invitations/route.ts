import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'

/**
 * GET /api/onboarding/invitations
 * Get pending invitations.
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/onboarding/invitations`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[API/ONBOARDING/INVITATIONS] GET Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/onboarding/invitations
 * Add a new pending invitation.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const apiUrl = getApiBaseUrl()

    const response = await fetch(`${apiUrl}/api/onboarding/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[API/ONBOARDING/INVITATIONS] POST Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
