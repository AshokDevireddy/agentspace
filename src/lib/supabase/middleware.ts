import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import type { Database } from './database.types'

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!)

export type UserProfile = {
  role: 'admin' | 'agent' | 'client' | null
  is_admin: boolean
  status: 'invited' | 'onboarding' | 'active' | 'inactive' | null
  subscription_tier: 'free' | 'pro' | 'expert' | null
}

export type UpdateSessionResult = {
  response: NextResponse
  user: { id: string; email?: string } | null
  supabase: ReturnType<typeof createClient<Database>>
}

interface SessionPayload {
  userId: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

/**
 * Validates the Django session cookie and returns user info.
 *
 * SECURITY: Uses httpOnly session cookie containing JWT-signed tokens.
 * The session is validated by verifying the JWT signature.
 */
export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  const response = NextResponse.next({ request })

  // Create a Supabase client for database queries (not auth)
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Get session cookie
  const sessionCookie = request.cookies.get('session')?.value
  if (!sessionCookie) {
    return {
      response,
      user: null,
      supabase,
    }
  }

  try {
    // Verify JWT signature
    const { payload } = await jwtVerify(sessionCookie, SECRET)
    const session = payload as unknown as SessionPayload

    // Check if session is expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
      return {
        response,
        user: null,
        supabase,
      }
    }

    // Session is valid - return user ID from session
    // Note: The userId in session is the users.id (not auth_user_id)
    return {
      response,
      user: { id: session.userId },
      supabase,
    }
  } catch {
    // Invalid session cookie
    return {
      response,
      user: null,
      supabase,
    }
  }
}

// Route configuration
export const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/setup-account',
] as const

export const PUBLIC_API_PREFIXES = [
  '/api/cron/',
  '/api/telnyx-webhook',
  '/api/webhooks/stripe',
  '/api/register',
  '/api/reset-password',
  '/api/favicon',
  '/api/auth/login',
  '/api/auth/token',
] as const

export const ADMIN_ROUTES = [
  '/configuration',
  '/api/create-user',
  '/api/setup-account',
  '/api/carriers/agency',
] as const

export const PRO_EXPERT_ROUTES = [
  '/underwriting',
  '/api/underwriting',
] as const

// Route matchers
export function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.includes(pathname as typeof PUBLIC_ROUTES[number]) ||
    pathname.startsWith('/auth/')
  )
}

export function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(route => pathname.startsWith(route))
}

export function isProExpertRoute(pathname: string): boolean {
  return PRO_EXPERT_ROUTES.some(route => pathname.startsWith(route))
}

export function isClientRoute(pathname: string): boolean {
  return pathname.startsWith('/client/')
}

// Response helpers
export function redirectTo(request: NextRequest, path: string, params?: Record<string, string>): NextResponse {
  const url = new URL(path, request.url)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }
  return NextResponse.redirect(url)
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json(
    { error: status === 401 ? 'Unauthorized' : 'Forbidden', message, ...extra },
    { status }
  )
}
