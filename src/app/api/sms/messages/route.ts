/**
 * Get SMS Messages API Route
 *
 * Proxies to Django backend for SMS messages.
 * Reads authentication from httpOnly session cookie.
 */

import { NextRequest, NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const conversationId = searchParams.get('conversationId')
  const view = searchParams.get('view') || 'downlines'

  if (!conversationId) {
    return NextResponse.json(
      { error: 'Missing conversationId parameter' },
      { status: 400 }
    )
  }

  // Build backend URL with mapped params
  const backendParams = new URLSearchParams()
  backendParams.set('conversation_id', conversationId)
  backendParams.set('view', view)

  return proxyToBackend(request, `/api/sms/messages?${backendParams.toString()}`)
}
