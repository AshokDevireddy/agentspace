import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Get user session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/setup-account']
  const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname) || req.nextUrl.pathname.startsWith('/auth/confirm')

  // Public API prefixes that should bypass auth (cron jobs, webhooks, etc.)
  const publicApiPrefixes = ['/api/cron/', '/api/telnyx-webhook']
  const isPublicApi = publicApiPrefixes.some(prefix => req.nextUrl.pathname.startsWith(prefix))

  // If no session and trying to access protected route
  if (!session && !isPublicRoute && !isPublicApi) {
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
  if (session) {
    // Get user profile to check role
    const { data: user } = await supabase
      .from('users')
      .select('role, is_admin, status')
      .eq('auth_user_id', session.user.id)
      .maybeSingle()

    // Handle user status
    if (user) {
      // If user is pending, only allow access to setup-account page
      if (user.status === 'pending') {
        if (req.nextUrl.pathname !== '/setup-account') {
          return NextResponse.redirect(new URL('/setup-account', req.url))
        }
        // Allow access to setup-account page
        return res
      }

      // If user is inactive, sign them out and redirect to login
      if (user.status === 'inactive') {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/login?message=account-deactivated', req.url))
      }
    }

    // Client-specific routes
    if (req.nextUrl.pathname.startsWith('/client/')) {
      if (!user || user.role !== 'client') {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
      return res
    }

    // If client tries to access non-client routes (except public routes and logout)
    if (user && user.role === 'client' && !isPublicRoute && !req.nextUrl.pathname.startsWith('/client/')) {
      return NextResponse.redirect(new URL('/client/dashboard', req.url))
    }
  }

  // Admin-only routes
  const adminRoutes = ['/configuration', '/api/create-user', '/api/setup-account', '/api/search-agent', '/api/carriers/agency']
  const isAdminRoute = adminRoutes.some(route => req.nextUrl.pathname.startsWith(route))

  if (isAdminRoute && session) {
    // Get user profile to check admin status
    const { data: user } = await supabase
      .from('users')
      .select('is_admin, role')
      .eq('auth_user_id', session.user.id)
      .maybeSingle()

    if (!user?.is_admin) {
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