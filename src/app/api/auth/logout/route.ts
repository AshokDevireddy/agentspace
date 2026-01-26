import { NextResponse } from 'next/server'
import { deleteSession, getAccessToken } from '@/lib/session'
import { getApiBaseUrl, authEndpoints } from '@/lib/api-config'

export async function POST() {
  try {
    const accessToken = await getAccessToken()

    // Invalidate backend session (best effort - don't fail if this fails)
    if (accessToken) {
      try {
        await fetch(`${getApiBaseUrl()}${authEndpoints.logout}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })
      } catch {
        // Continue with local logout even if backend call fails
      }
    }

    // Delete httpOnly session cookie
    await deleteSession()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API/auth/logout] Error:', error)
    // Still try to delete session even on error
    try {
      await deleteSession()
    } catch {
      // Ignore
    }
    return NextResponse.json({ success: true })
  }
}
