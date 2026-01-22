/**
 * API Configuration for Django Backend
 *
 * Provides utilities for constructing API URLs based on the backend being used.
 */

/**
 * Get the Django API base URL
 */
export function getDjangoApiUrl(): string {
  return process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000'
}

/**
 * Get the full API endpoint URL
 *
 * @param path - The API path (e.g., '/api/auth/login')
 * @param useDjango - Whether to use Django backend
 * @returns Full URL for Django, relative path for Next.js
 */
export function getApiEndpoint(path: string, useDjango: boolean): string {
  if (useDjango) {
    return `${getDjangoApiUrl()}${path}`
  }
  // Relative URL for Next.js API routes
  return path
}

/**
 * Auth-specific endpoints
 */
export const djangoAuthEndpoints = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  refresh: '/api/auth/refresh',
  session: '/api/auth/session',
  register: '/api/auth/register',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
  verifyInvite: '/api/auth/verify-invite',
  setupAccount: '/api/auth/setup-account',
} as const

/**
 * Dashboard-specific endpoints
 */
export const djangoDashboardEndpoints = {
  summary: '/api/dashboard/summary',
  scoreboard: '/api/dashboard/scoreboard',
  production: '/api/dashboard/production',
} as const

/**
 * Get full Django auth endpoint URL
 */
export function getDjangoAuthEndpoint(
  endpoint: keyof typeof djangoAuthEndpoints
): string {
  return `${getDjangoApiUrl()}${djangoAuthEndpoints[endpoint]}`
}

/**
 * Get full Django dashboard endpoint URL
 */
export function getDjangoDashboardEndpoint(
  endpoint: keyof typeof djangoDashboardEndpoints
): string {
  return `${getDjangoApiUrl()}${djangoDashboardEndpoints[endpoint]}`
}
