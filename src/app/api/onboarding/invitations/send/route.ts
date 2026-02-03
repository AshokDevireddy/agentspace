import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'

/**
 * POST /api/onboarding/invitations/send
 * Send all pending invitations and clear the list.
 */
export async function POST() {
  try {
    const session = await getSession()
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/onboarding/invitations/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[API/ONBOARDING/INVITATIONS/SEND] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
