/**
 * User-related query hooks for TanStack Query
 * Centralized user data fetching with proper caching
 *
 * Uses apiClient for direct backend calls.
 */

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from './queryKeys'

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
  /** Access token - kept for backward compatibility but not used (auth via apiClient) */
  accessToken?: string
  /** Whether to enable the query */
  enabled?: boolean
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number
}

/**
 * Fetch user profile data by auth_user_id
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

      return apiClient.get<UserProfileData>('/api/user/profile/')
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

      return apiClient.get<AgencyBrandingData>(`/api/agencies/${agencyId}/settings/`)
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
 */
export function useAgencyBrandingByDomain(
  domain: string | null,
  options: UseAgencyBrandingByDomainOptions = {}
) {
  const { enabled = true, staleTime = 60 * 60 * 1000 } = options

  return useQuery({
    queryKey: queryKeys.agencyBrandingByDomain(domain),
    queryFn: async () => {
      if (!domain) return null

      try {
        return await apiClient.get<AgencyBrandingData | null>(
          '/api/agencies/by-domain/',
          { params: { domain } }
        )
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return null
        }
        throw error
      }
    },
    enabled: enabled && !!domain,
    staleTime,
  })
}

// ============ Agency Scoreboard Settings Query ============

interface AgencyScoreboardSettings {
  defaultScoreboardStartDate: string | null
  scoreboardAgentVisibility: boolean | null
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
 */
export function useAgencyScoreboardSettings(
  agencyId: string | null | undefined,
  options: UseAgencyScoreboardSettingsOptions = {}
) {
  const { enabled = true, staleTime = 60 * 60 * 1000 } = options

  return useQuery({
    queryKey: queryKeys.agencyScoreboardSettings(agencyId ?? null),
    queryFn: async () => {
      if (!agencyId) {
        throw new Error('Agency ID is required')
      }

      return apiClient.get<AgencyScoreboardSettings>(`/api/agencies/${agencyId}/scoreboard-settings/`)
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

      return apiClient.get<UserProfileData>(`/api/user/${userId}/`)
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

      const data = await apiClient.get<UserProfileData>('/api/user/profile/')
      return {
        isAdmin: data.isAdmin || false
      } as AdminStatusData
    },
    enabled: enabled && !!authUserId,
    staleTime,
  })
}
