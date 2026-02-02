/**
 * Client-side authentication utilities
 *
 * These utilities work in browser contexts and fetch auth data
 * from the Django session via Next.js API routes.
 */

let cachedToken: { token: string; expiresAt: number } | null = null
const TOKEN_CACHE_DURATION_MS = 30 * 1000 // 30 seconds

/**
 * Fetches the access token from the session for client-side use.
 *
 * This replaces the Supabase pattern:
 * ```typescript
 * const { data: { session } } = await supabase.auth.getSession()
 * const accessToken = session?.access_token
 * ```
 *
 * With the Django session pattern:
 * ```typescript
 * const accessToken = await getClientAccessToken()
 * ```
 *
 * Features:
 * - Short-lived cache (30s) to reduce API calls
 * - Returns null if not authenticated
 * - Automatically clears cache on error
 *
 * @returns The access token or null if not authenticated
 */
export async function getClientAccessToken(): Promise<string | null> {
  // Check cache first
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  try {
    const response = await fetch('/api/auth/token', {
      credentials: 'include',
    })

    if (!response.ok) {
      cachedToken = null
      return null
    }

    const data = await response.json()
    const token = data.accessToken

    if (token) {
      cachedToken = {
        token,
        expiresAt: Date.now() + TOKEN_CACHE_DURATION_MS,
      }
    }

    return token || null
  } catch (error) {
    console.error('[getClientAccessToken] Error fetching token:', error)
    cachedToken = null
    return null
  }
}

/**
 * Clears the token cache.
 *
 * Call this after logout or when you need to force a fresh token fetch.
 */
export function clearTokenCache(): void {
  cachedToken = null
}

/**
 * Checks if the user has a valid session without fetching user data.
 *
 * This is faster than fetching the full session when you only need
 * to know if the user is authenticated.
 *
 * @returns true if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getClientAccessToken()
  return token !== null
}
