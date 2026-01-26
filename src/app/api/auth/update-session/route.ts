import { NextResponse } from 'next/server'
import { updateSession, getSession } from '@/lib/session'

export async function POST(request: Request) {
  try {
    const { access_token, refresh_token } = await request.json()

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Missing tokens' },
        { status: 400 }
      )
    }

    // Verify we have an existing session to update
    const currentSession = await getSession()
    if (!currentSession) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      )
    }

    // Update the session with new tokens
    await updateSession({
      accessToken: access_token,
      refreshToken: refresh_token,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API/auth/update-session] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}
