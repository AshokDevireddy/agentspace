import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!)

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/setup-account',
]

// Auth callback routes (OAuth, email confirmation, etc.)
const AUTH_ROUTES = ['/auth/callback', '/auth/confirm']

// API routes that should be public
const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-invite',
  '/api/auth/update-session', // Token refresh - validates existing session internally
  '/api/auth/refresh-session', // Proactive token refresh - validates existing session internally
  '/api/cron/',
  '/api/telnyx-webhook',
  '/api/webhooks/stripe',
  '/api/favicon',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Allow auth callback routes
  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Allow public API routes
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // Check session cookie
  const sessionCookie = request.cookies.get('session')?.value
  if (!sessionCookie) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // For pages, redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(sessionCookie, SECRET)
    const session = payload as { accessToken: string }

    // Check if accessToken (Supabase JWT) is expired
    // The outer session cookie (7 days) may be valid but the accessToken (~1 hour) may have expired
    if (session.accessToken) {
      const tokenParts = session.accessToken.split('.')
      if (tokenParts.length === 3) {
        try {
          const tokenPayload = JSON.parse(atob(tokenParts[1]))
          // Check if accessToken is expired (with 30 second buffer)
          if (tokenPayload.exp && tokenPayload.exp * 1000 < Date.now() - 30000) {
            // Token expired - redirect to login and clear session
            if (pathname.startsWith('/api/')) {
              const response = NextResponse.json({ error: 'Token expired' }, { status: 401 })
              response.cookies.delete('session')
              return response
            }
            const response = NextResponse.redirect(new URL('/login', request.url))
            response.cookies.delete('session')
            return response
          }
        } catch {
          // Failed to parse token - continue with normal flow
        }
      }
    }

    return NextResponse.next()
  } catch {
    // Invalid/expired session - clear cookie and redirect
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.delete('session')
      return response
    }

    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('session')
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)',
  ],
}
