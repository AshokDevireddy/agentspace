/**
 * Complete Onboarding API Route
 *
 * Proxies to Django backend to mark user as having completed onboarding.
 * Reads authentication from httpOnly session cookie.
 */

import { proxyPost } from '@/lib/api-proxy'

export async function POST(request: Request) {
  return proxyPost(request, '/api/user/complete-onboarding')
}
