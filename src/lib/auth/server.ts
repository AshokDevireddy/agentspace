/**
 * Server-side auth helper.
 *
 * Reads the access_token cookie directly (NOT getSession() which is untrusted
 * server-side per Supabase docs). Forwards as Bearer to Django for validation.
 *
 * Zero Supabase SDK. Just cookies() + fetch.
 */
import { cookies } from 'next/headers'
import { getApiBaseUrl } from '@/lib/api-config'

interface AuthUser {
  id: string
  authUserId: string
  email: string
  agencyId: string | null
  role: 'admin' | 'agent' | 'client'
  isAdmin: boolean
  status: 'active' | 'onboarding' | 'invited' | 'inactive'
  subscriptionTier: 'free' | 'basic' | 'pro' | 'expert'
  themeMode: 'light' | 'dark' | 'system' | null
}

interface AuthAgency {
  displayName: string | null
  whitelabelDomain: string | null
  logoUrl: string | null
}

export interface AuthSession {
  accessToken: string
  user: AuthUser
  agency: AuthAgency | null
}

/**
 * Get the current auth session server-side.
 * Returns null if not authenticated (no cookie or Django rejects the token).
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value

  if (!accessToken) return null

  try {
    const apiUrl = getApiBaseUrl()
    const res = await fetch(`${apiUrl}/api/auth/session/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (!res.ok) return null

    const data = await res.json()
    if (!data.authenticated || !data.user) return null

    return {
      accessToken,
      user: {
        id: data.user.id,
        authUserId: data.user.auth_user_id || '',
        email: data.user.email,
        role: data.user.role,
        status: data.user.status,
        themeMode: data.user.theme_mode || null,
        isAdmin: data.user.is_admin,
        agencyId: data.user.agency_id,
        subscriptionTier: data.user.subscription_tier || 'free',
      },
      agency: data.agency ? {
        displayName: data.agency.display_name,
        whitelabelDomain: data.agency.whitelabel_domain,
        logoUrl: data.agency.logo_url,
      } : null,
    }
  } catch (error) {
    console.error('[getAuthSession] Error:', error)
    return null
  }
}
