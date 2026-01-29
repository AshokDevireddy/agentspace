import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.accessToken) {
      return NextResponse.json({ completed: false, carriers: [] })
    }

    // Use Django API to check NIPR completion status
    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/nipr/check-completed`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json({ completed: false, carriers: [] })
    }

    const data = await response.json()
    return NextResponse.json({
      completed: data.completed,
      carriers: data.carriers || []
    })
  } catch (error) {
    console.error('[API/NIPR/STATUS] Error:', error)
    return NextResponse.json({ completed: false, carriers: [] })
  }
}
