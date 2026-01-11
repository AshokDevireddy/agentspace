import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export type UserProfile = {
  role: 'admin' | 'agent' | 'client' | null
  is_admin: boolean
  status: 'invited' | 'onboarding' | 'active' | 'inactive' | null
  subscription_tier: 'free' | 'pro' | 'expert' | null
}

export type UpdateSessionResult = {
  response: NextResponse
  user: { id: string; email?: string } | null
  supabase: ReturnType<typeof createServerClient>
}

/**
 * Updates the user session and handles cookie management for middleware.
 *
 * CRITICAL: Uses getUser() instead of getSession() for security.
 * getUser() validates the JWT against Supabase Auth server.
 * getSession() only reads from cookies and can be spoofed.
 */
export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update cookies on the request for downstream processing
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

          // Create new response with updated request
          supabaseResponse = NextResponse.next({ request })

          // Set cookies on response for the browser
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: Use getUser() NOT getSession()
  // getUser() validates JWT against Supabase Auth server (secure)
  // getSession() only reads from cookies (can be spoofed)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      response: supabaseResponse,
      user: null,
      supabase,
    }
  }

  return {
    response: supabaseResponse,
    user: { id: user.id, email: user.email },
    supabase,
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
