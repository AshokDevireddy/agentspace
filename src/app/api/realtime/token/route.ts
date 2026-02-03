import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/session'

/**
 * Returns the access token for Supabase realtime subscriptions.
 * The client uses this token with supabase.realtime.setAuth().
 *
 * SECURITY: This endpoint exposes access tokens and should be rate-limited.
 * Rate limiting is handled at the infrastructure level (Vercel/Cloudflare).
 */
export async function GET() {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Return token for Supabase realtime with cache-control headers
  // SECURITY: Set no-store to prevent token caching in proxies/browsers
  return NextResponse.json(
    { token: accessToken },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
      },
    }
  )
}
