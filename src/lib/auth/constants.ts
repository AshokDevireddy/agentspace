// Single request timeout - used for individual auth operations
export const AUTH_TIMEOUT_MS = 15000 // Increased from 5000 to handle Vercel cold starts (2-8s)
export const REDIRECT_DELAY_MS = 2000

// Retry timeouts for auth server validation (used in AuthProvider)
// Handles hard refresh scenarios where localStorage is empty but server session is valid
// Uses exponential backoff: 5s -> 8s -> 15s (total ~28s with retries)
export const AUTH_RETRY_TIMEOUTS = [5000, 8000, 15000] as const

export interface HashTokens {
  accessToken: string
  refreshToken: string
  type: string | null
}

export function captureHashTokens(requiredType?: string): HashTokens | null {
  if (typeof window === 'undefined') return null

  const hash = window.location.hash.substring(1)
  if (!hash) return null

  const params = new URLSearchParams(hash)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  const type = params.get('type')

  if (requiredType && type !== requiredType) return null
  if (!accessToken || !refreshToken) return null

  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return { accessToken, refreshToken, type }
}

export function withTimeout<T>(promise: Promise<T>, ms = AUTH_TIMEOUT_MS): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms)
  )
  return Promise.race([promise, timeout])
}

export const TOKEN_STORAGE_KEYS = {
  INVITE_ACCESS: 'invite_access_token',
  INVITE_REFRESH: 'invite_refresh_token',
  RECOVERY_ACCESS: 'recovery_access_token',
  RECOVERY_REFRESH: 'recovery_refresh_token',
  LOGIN_ACCESS: 'login_access_token',
  LOGIN_REFRESH: 'login_refresh_token',
} as const

export function clearInviteTokens() {
  localStorage.removeItem(TOKEN_STORAGE_KEYS.INVITE_ACCESS)
  localStorage.removeItem(TOKEN_STORAGE_KEYS.INVITE_REFRESH)
}

export function clearRecoveryTokens() {
  localStorage.removeItem(TOKEN_STORAGE_KEYS.RECOVERY_ACCESS)
  localStorage.removeItem(TOKEN_STORAGE_KEYS.RECOVERY_REFRESH)
}

export function storeInviteTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_STORAGE_KEYS.INVITE_ACCESS, accessToken)
  localStorage.setItem(TOKEN_STORAGE_KEYS.INVITE_REFRESH, refreshToken)
}

export function storeRecoveryTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_STORAGE_KEYS.RECOVERY_ACCESS, accessToken)
  localStorage.setItem(TOKEN_STORAGE_KEYS.RECOVERY_REFRESH, refreshToken)
}

export function getInviteTokens(): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: localStorage.getItem(TOKEN_STORAGE_KEYS.INVITE_ACCESS),
    refreshToken: localStorage.getItem(TOKEN_STORAGE_KEYS.INVITE_REFRESH)
  }
}

export function getRecoveryTokens(): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: localStorage.getItem(TOKEN_STORAGE_KEYS.RECOVERY_ACCESS),
    refreshToken: localStorage.getItem(TOKEN_STORAGE_KEYS.RECOVERY_REFRESH)
  }
}
