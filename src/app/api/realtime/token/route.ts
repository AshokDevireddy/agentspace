import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/session'

/**
 * Returns the access token for Supabase realtime subscriptions.
 * The client uses this token with supabase.realtime.setAuth().
 */
export async function GET() {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Return token for Supabase realtime
  return NextResponse.json({ token: accessToken })
}
