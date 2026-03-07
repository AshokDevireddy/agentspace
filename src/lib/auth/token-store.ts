/**
 * Module-level token store.
 *
 * Holds the access_token in memory. Initialized from cookie on page load.
 * Updated by AuthProvider on login/refresh/logout.
 *
 * This replaces the old pattern of fetching the token from a Next.js API route
 * (getClientAccessToken → GET /api/auth/token → session cookie → extract JWT).
 * Now the token lives in a non-httpOnly cookie set by Django, and we read it
 * directly on the client.
 */

let currentToken: string | null = null

const LS_TOKEN_KEY = 'access_token'

export function setAccessToken(token: string | null) {
  currentToken = token
  // Persist to localStorage so the token survives full page reloads
  // when the cookie is cross-origin (e.g. localhost → prod API).
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(LS_TOKEN_KEY, token)
    } else {
      localStorage.removeItem(LS_TOKEN_KEY)
    }
  }
}

export function getAccessToken(): string | null {
  return currentToken
}

/**
 * Read access_token cookie on page load to initialize the store.
 * Falls back to localStorage when the cookie is not readable
 * (e.g. cross-origin: localhost frontend → remote API backend).
 * Called once from AuthProvider on mount.
 */
export function initTokenFromCookie() {
  if (typeof document === 'undefined') return
  const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/)
  if (match) {
    currentToken = decodeURIComponent(match[1])
  } else if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LS_TOKEN_KEY)
    if (stored) {
      currentToken = stored
    }
  }
}

/**
 * Clear the token (called on logout).
 * Also deletes the browser cookie so middleware stops seeing it.
 */
export function clearAccessToken() {
  currentToken = null
  if (typeof document !== 'undefined') {
    document.cookie = 'access_token=; Max-Age=0; path=/'
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LS_TOKEN_KEY)
  }
}
