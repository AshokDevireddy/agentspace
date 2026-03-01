/**
 * API Configuration
 *
 * Provides utilities for constructing API URLs.
 */

/**
 * Get the API base URL (Django backend)
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}

/**
 * Alias for getApiBaseUrl
 */
export const getBackendUrl = getApiBaseUrl

// ============================================================================
// Auth Endpoints (used by Next.js auth routes that manage httpOnly cookies)
// ============================================================================

export const authEndpoints = {
  login: '/api/auth/login/',
  logout: '/api/auth/logout/',
  refresh: '/api/auth/refresh/',
  session: '/api/auth/session/',
  register: '/api/auth/register/',
  forgotPassword: '/api/auth/forgot-password/',
  resetPassword: '/api/auth/reset-password/',
  verifyInvite: '/api/auth/verify-invite/',
  setupAccount: '/api/auth/setup-account/',
} as const

export function getAuthEndpoint(
  endpoint: keyof typeof authEndpoints
): string {
  return `${getApiBaseUrl()}${authEndpoints[endpoint]}`
}

// ============================================================================
// Onboarding Endpoints (used by useOnboardingProgress hook)
// ============================================================================

export const onboardingEndpoints = {
  progress: '/api/onboarding/progress/',
  complete: '/api/onboarding/complete/',
  invitations: '/api/onboarding/invitations/',
  invitationsSend: '/api/onboarding/invitations/send/',
  invitationDelete: (index: number) => `/api/onboarding/invitations/${index}/`,
} as const

export function getOnboardingEndpoint(
  endpoint: keyof typeof onboardingEndpoints,
  index?: number
): string {
  const ep = onboardingEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(index!) : ep
  return `${getApiBaseUrl()}${path}`
}
