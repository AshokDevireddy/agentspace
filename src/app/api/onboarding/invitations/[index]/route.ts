import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'

/**
 * DELETE /api/onboarding/invitations/{index}
 * Remove a pending invitation by index.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ index: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { index } = await params
    const apiUrl = getApiBaseUrl()

    const response = await fetch(`${apiUrl}/api/onboarding/invitations/${index}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[API/ONBOARDING/INVITATIONS/DELETE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
