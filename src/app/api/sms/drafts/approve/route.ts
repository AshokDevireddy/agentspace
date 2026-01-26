/**
 * Approve SMS Drafts API Route
 *
 * Proxies to Django backend for approving and sending draft SMS messages.
 * Reads authentication from httpOnly session cookie.
 */

import { proxyPost } from '@/lib/api-proxy'

export async function POST(request: Request) {
  return proxyPost(request, '/api/sms/drafts/approve/')
}
