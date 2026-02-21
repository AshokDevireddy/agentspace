/**
 * User-related query hooks for TanStack Query
 * Centralized user data fetching with proper caching
 *
 * Migrated to use Django API via Next.js API routes
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

// ============ API Helper ============

/**
 * Internal helper to call Next.js API routes with credentials.
 * These routes handle auth via httpOnly cookies.
 */
async function apiCall<T>(endpoint: string): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.message || `API call failed: ${response.status}`)
  }

  return response.json()
}

// ============ User Profile Query ============

interface UserProfileData {
  id: string
  authUserId?: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  role: string
  status: string
  agencyId: string
  agencyName: string | null
  positionId: string | null
  positionName: string | null
  positionLevel: number | null
  isAdmin: boolean
  permLevel: string | null
  subscriptionTier: string | null
  startDate: string | null
  annualGoal: number | null
  totalProd: number
  totalPoliciesSold: number
  createdAt: string
}

interface UseUserProfileOptions {
  /** Access token - kept for backward compatibility but not used (auth via httpOnly cookie) */
  accessToken?: string
  /** Whether to enable the query */
  enabled?: boolean
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number
}

/**
 * Fetch user profile data by auth_user_id
 * Uses Django API via /api/user/profile
 */
export function useUserProfile(
  authUserId: string | undefined,
  options: UseUserProfileOptions = {}
) {
  const { enabled = true, staleTime = 5 * 60 * 1000 } = options

  return useQuery({
    queryKey: queryKeys.userProfile(authUserId),
    queryFn: async () => {
      if (!authUserId) {
        throw new Error('User ID is required')
      }

      const data = await apiCall<UserProfileData>('/user/profile')
      return data
    },
    enabled: enabled && !!authUserId,
    staleTime,
  })
}

// ============ Agency Branding Query ============

interface AgencyBrandingData {
  id: string
  name: string
  displayName: string | null
  logoUrl: string | null
  primaryColor: string | null
  themeMode: string | null
  whitelabelDomain: string | null
}

interface UseAgencyBrandingOptions {
  /** Access token - kept for backward compatibility */
  accessToken?: string
  /** Whether to enable the query */
  enabled?: boolean
  /** Stale time in milliseconds (default: 1 hour - branding rarely changes) */
  staleTime?: number
}

/**
 * Fetch agency branding data by agency ID
 * Uses Django API via /api/agencies/{id}/settings
 */
export function useAgencyBranding(
  agencyId: string | null | undefined,
  options: UseAgencyBrandingOptions = {}
) {
  const { enabled = true, staleTime = 60 * 60 * 1000 } = options

  return useQuery({
    queryKey: queryKeys.agencyBranding(agencyId ?? null),
    queryFn: async () => {
      if (!agencyId) {
        throw new Error('Agency ID is required')
      }

      const data = await apiCall<AgencyBrandingData>(`/agencies/${agencyId}/settings`)
      return data
    },
    enabled: enabled && !!agencyId,
    staleTime,
  })
}

// ============ Agency Branding by Domain Query ============

interface UseAgencyBrandingByDomainOptions {
  /** Whether to enable the query */
  enabled?: boolean
  /** Stale time in milliseconds (default: 1 hour - branding rarely changes) */
  staleTime?: number
}

/**
 * Fetch agency branding data by whitelabel domain
 * Used for domain-based white-label detection
 * Uses Django API via /api/agencies/by-domain
 */
export function useAgencyBrandingByDomain(
  domain: string | null,
  options: UseAgencyBrandingByDomainOptions = {}
) {
  const { enabled = true, staleTime = 60 * 60 * 1000 } = options // 1 hour default

  return useQuery({
    queryKey: queryKeys.agencyBrandingByDomain(domain),
    queryFn: async () => {
      if (!domain) return null

      const response = await fetch(`/api/agencies/by-domain?domain=${encodeURIComponent(domain)}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch agency by domain')
      }

      return response.json() as Promise<AgencyBrandingData | null>
    },
    enabled: enabled && !!domain,
    staleTime,
  })
}

// ============ Agency Scoreboard Settings Query ============

interface AgencyScoreboardSettings {
  default_scoreboard_start_date: string | null
  scoreboard_agent_visibility: boolean | null
}

interface UseAgencyScoreboardSettingsOptions {
  /** Whether to enable the query */
  enabled?: boolean
  /** Stale time in milliseconds (default: 1 hour - rarely changes) */
  staleTime?: number
}

/**
 * Fetch agency scoreboard settings (default start date)
 * Used by the scoreboard page to determine default date range
 * Uses Django API via /api/agencies/{id}/scoreboard-settings
 */
export function useAgencyScoreboardSettings(
  agencyId: string | null | undefined,
  options: UseAgencyScoreboardSettingsOptions = {}
) {
  const { enabled = true, staleTime = 60 * 60 * 1000 } = options // 1 hour - rarely changes

  return useQuery({
    queryKey: queryKeys.agencyScoreboardSettings(agencyId ?? null),
    queryFn: async () => {
      if (!agencyId) {
        throw new Error('Agency ID is required')
      }

      const data = await apiCall<AgencyScoreboardSettings>(`/agencies/${agencyId}/scoreboard-settings`)
      return data
    },
    enabled: enabled && !!agencyId,
    staleTime,
  })
}

// ============ User by ID Query ============

interface UseUserByIdOptions {
  /** Access token - kept for backward compatibility */
  accessToken?: string
  /** Whether to enable the query */
  enabled?: boolean
  /** Stale time in milliseconds */
  staleTime?: number
}

/**
 * Fetch user data by user ID (not auth_user_id)
 * Useful for fetching other users' data
 * Uses Django API via /api/user/{id}
 */
export function useUserById(
  userId: string | undefined,
  options: UseUserByIdOptions = {}
) {
  const { enabled = true, staleTime = 5 * 60 * 1000 } = options

  return useQuery({
    queryKey: queryKeys.userById(userId || ''),
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required')
      }

      const data = await apiCall<UserProfileData>(`/user/${userId}`)
      return data
    },
    enabled: enabled && !!userId,
    staleTime,
  })
}

// ============ Admin Status Query ============

interface AdminStatusData {
  isAdmin: boolean
}

interface UseAdminStatusOptions {
  /** Whether to enable the query */
  enabled?: boolean
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number
}

/**
 * Check if the current user has admin privileges
 * Used for admin-only pages and features
 * Uses the user profile endpoint which includes isAdmin
 */
export function useAdminStatus(
  authUserId: string | undefined,
  options: UseAdminStatusOptions = {}
) {
  const { enabled = true, staleTime = 5 * 60 * 1000 } = options

  return useQuery({
    queryKey: queryKeys.userAdminStatus(authUserId),
    queryFn: async () => {
      if (!authUserId) {
        throw new Error('User ID is required')
      }

      const data = await apiCall<UserProfileData>('/user/profile')
      return {
        isAdmin: data.isAdmin || false
      } as AdminStatusData
    },
    enabled: enabled && !!authUserId,
    staleTime,
  })
}
