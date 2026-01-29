/**
 * Carrier Logins API Route
 * Proxies to Django backend for carrier portal credential management.
 */

import { NextRequest, NextResponse } from 'next/server'
import { proxyPost } from '@/lib/api-proxy'

export async function POST(request: NextRequest) {
  try {
    // Proxy to Django carrier logins endpoint
    return proxyPost(request, '/api/carriers/logins')
  } catch (error) {
    console.error('API Error (POST /api/carrier-logins):', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
