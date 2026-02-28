import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js 16 proxy — cookie-based auth check only.
 *
 * No Supabase SDK. No jose. No network calls.
 * Just reads the access_token cookie set by Django and redirects if missing.
 */

const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/setup-account',
]

const AUTH_ROUTES = ['/auth/callback', '/auth/confirm']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public page routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    // If user has a token and visits /login, redirect to dashboard
    if (pathname === '/login' && request.cookies.has('access_token')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Allow auth callback routes
  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check access_token cookie (set by Django on login/refresh)
  const hasToken = request.cookies.has('access_token')

  if (!hasToken) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // For pages, redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
