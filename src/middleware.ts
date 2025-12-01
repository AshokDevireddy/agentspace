import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => req.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/setup-account']
  const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname) || req.nextUrl.pathname.startsWith('/auth/confirm') || req.nextUrl.pathname.startsWith('/auth/callback')

  // Public API prefixes that should bypass auth (cron jobs, webhooks, registration, password reset, favicon, etc.)
  const publicApiPrefixes = ['/api/cron/', '/api/telnyx-webhook', '/api/webhooks/stripe', '/api/register', '/api/reset-password', '/api/favicon']
  const isPublicApi = publicApiPrefixes.some(prefix => req.nextUrl.pathname.startsWith(prefix))

  // If no user and trying to access protected route
  if (!user && !isPublicRoute && !isPublicApi) {
    // For API routes, return 401 instead of redirecting
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // If user is authenticated, check role-based access
  if (user) {
    // Get user profile to check role
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, is_admin, status')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    // Handle user status
    if (userProfile) {
      // Allow password recovery flow - users need to access /forgot-password even with certain statuses
      if (req.nextUrl.pathname === '/forgot-password') {
        return res
      }

      // If user is onboarding, allow access to setup-account page and dashboard
      // (setup-account for Phase 1 password setup, dashboard for Phase 2 onboarding)
      if (userProfile.status === 'onboarding') {
        const allowedPaths = ['/setup-account', '/', '/api/']
        const isAllowedPath = allowedPaths.some(path => req.nextUrl.pathname.startsWith(path))

        if (!isAllowedPath) {
          // Redirect to dashboard where they can complete onboarding
          return NextResponse.redirect(new URL('/', req.url))
        }
        // Allow access to allowed paths
        return res
      }

      // If user is invited (hasn't clicked invite link yet), redirect to login
      if (userProfile.status === 'invited') {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/login?message=check-email', req.url))
      }

      // If user is inactive, sign them out and redirect to login
      if (userProfile.status === 'inactive') {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/login?message=account-deactivated', req.url))
      }
    }

    // Client-specific routes
    if (req.nextUrl.pathname.startsWith('/client/')) {
      if (!userProfile || userProfile.role !== 'client') {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
      return res
    }

    // If client tries to access non-client routes (except public routes and logout)
    if (userProfile && userProfile.role === 'client' && !isPublicRoute && !req.nextUrl.pathname.startsWith('/client/')) {
      return NextResponse.redirect(new URL('/client/dashboard', req.url))
    }
  }

  // Admin-only routes
  const adminRoutes = ['/configuration', '/api/create-user', '/api/setup-account', '/api/carriers/agency']
  const isAdminRoute = adminRoutes.some(route => req.nextUrl.pathname.startsWith(route))

  if (isAdminRoute && user) {
    // Get user profile to check admin status
    const { data: adminCheckUser } = await supabase
      .from('users')
      .select('is_admin, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!adminCheckUser?.is_admin) {
      const isApiRoute = req.nextUrl.pathname.startsWith('/api/')
      if (isApiRoute) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Admin access required' },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}