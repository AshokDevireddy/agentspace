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
  // Treat any auth callback path starting with /auth/confirm as public (handles extra params)
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password']
  const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname) || req.nextUrl.pathname.startsWith('/auth/confirm')

  // If no session and trying to access protected route
  if (!session && !isPublicRoute) {
    // For API routes, return 401 instead of redirecting
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Admin-only routes
  const adminRoutes = ['/configuration', '/payments/reports', '/api/create-user', '/api/setup-account', '/api/search-agent', '/api/positions', '/api/carriers/agency']
  const isAdminRoute = adminRoutes.some(route => req.nextUrl.pathname.startsWith(route))
  // console.log('isAdminRoute', isAdminRoute)
  if (isAdminRoute && session) {
    // Get user profile to check admin status
    const { data: user } = await supabase
      .from('users')
      .select('is_admin')
      .eq('auth_user_id', session.user.id)
      .single()

      if (!user?.is_admin) {
        const isApiRoute = req.nextUrl.pathname.startsWith('/api/');
        if (isApiRoute) {
          return NextResponse.json(
            { error: 'Forbidden', message: 'Admin access required' },
            { status: 403 }
          );
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