/**
 * User-related query hooks for TanStack Query
 * Centralized user data fetching with proper caching
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'
import { supabaseRestFetch } from '@/lib/supabase/api'
import { createClient } from '@/lib/supabase/client'

// ============ User Profile Query ============

interface UserProfileData {
  id: string
  auth_user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone_number: string | null
  role: string
  status: string
  agency_id: string
  position_level: number | null
  upline_id: string | null
  created_at: string
  updated_at: string
}

interface UseUserProfileOptions {
  /** Access token for REST API calls (optional - will use Supabase client if not provided) */
  accessToken?: string
  /** Whether to enable the query */
  enabled?: boolean
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number
}

/**
 * Fetch user profile data by auth_user_id
 * Can use either REST API (with access token) or Supabase client
 */
export function useUserProfile(
  authUserId: string | undefined,
  options: UseUserProfileOptions = {}
) {
  const { accessToken, enabled = true, staleTime = 5 * 60 * 1000 } = options

  return useQuery({
    queryKey: queryKeys.userProfile(authUserId),
    queryFn: async () => {
      if (!authUserId) {
        throw new Error('User ID is required')
      }

      // If access token provided, use REST API
      if (accessToken) {
        const { data, error } = await supabaseRestFetch<UserProfileData[]>(
          `/rest/v1/users?auth_user_id=eq.${authUserId}&select=*`,
          { accessToken }
        )

        if (error) {
          throw new Error(error)
        }

        return data?.[0] || null
      }

      // Otherwise use Supabase client
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      if (error) {
        throw new Error(error.message)
      }

      return data as UserProfileData | null
    },
    enabled: enabled && !!authUserId,
    staleTime,
  })
}

// ============ Agency Branding Query ============

interface AgencyBrandingData {
  id: string
  name: string
  display_name: string | null
  logo_url: string | null
  primary_color: string | null
  theme_mode: string | null
  whitelabel_domain: string | null
}

interface UseAgencyBrandingOptions {
  /** Access token for REST API calls (optional) */
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
  const { accessToken, enabled = true, staleTime = 60 * 60 * 1000 } = options

  return useQuery({
    queryKey: queryKeys.agencyBranding(agencyId ?? null),
    queryFn: async () => {
      if (!agencyId) {
        throw new Error('Agency ID is required')
      }

      // If access token provided, use REST API
      if (accessToken) {
        const { data, error } = await supabaseRestFetch<AgencyBrandingData[]>(
          `/rest/v1/agencies?id=eq.${agencyId}&select=id,name,display_name,logo_url,primary_color,theme_mode,whitelabel_domain`,
          { accessToken }
        )

        if (error) {
          throw new Error(error)
        }

        return data?.[0] || null
      }

      // Otherwise use Supabase client
      const supabase = createClient()
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name, display_name, logo_url, primary_color, theme_mode, whitelabel_domain')
        .eq('id', agencyId)
        .maybeSingle()

      if (error) {
        throw new Error(error.message)
      }

      return data as AgencyBrandingData | null
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
  const { enabled = true, staleTime = 60 * 60 * 1000 } = options // 1 hour default

  return useQuery({
    queryKey: queryKeys.agencyBrandingByDomain(domain),
    queryFn: async () => {
      if (!domain) return null

      const supabase = createClient()
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name, display_name, logo_url, primary_color, theme_mode, whitelabel_domain')
        .eq('whitelabel_domain', domain)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw new Error(error.message)
      return data as AgencyBrandingData | null
    },
    enabled: enabled && !!domain,
    staleTime,
  })
}

// ============ Agency Scoreboard Settings Query ============

interface AgencyScoreboardSettings {
  default_scoreboard_start_date: string | null
  issue_paid_status: boolean | null
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
  const { enabled = true, staleTime = 60 * 60 * 1000 } = options // 1 hour - rarely changes

  return useQuery({
    queryKey: queryKeys.agencyScoreboardSettings(agencyId ?? null),
    queryFn: async () => {
      if (!agencyId) {
        throw new Error('Agency ID is required')
      }

      const supabase = createClient()
      const { data, error } = await supabase
        .from('agencies')
        .select('default_scoreboard_start_date, issue_paid_status')
        .eq('id', agencyId)
        .maybeSingle()

      if (error) {
        throw new Error(error.message)
      }

      return data as AgencyScoreboardSettings | null
    },
    enabled: enabled && !!agencyId,
    staleTime,
  })
}

// ============ User by ID Query ============

interface UseUserByIdOptions {
  /** Access token for REST API calls (optional) */
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
  const { accessToken, enabled = true, staleTime = 5 * 60 * 1000 } = options

  return useQuery({
    queryKey: queryKeys.userById(userId || ''),
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required')
      }

      // If access token provided, use REST API
      if (accessToken) {
        const { data, error } = await supabaseRestFetch<UserProfileData[]>(
          `/rest/v1/users?id=eq.${userId}&select=*`,
          { accessToken }
        )

        if (error) {
          throw new Error(error)
        }

        return data?.[0] || null
      }

      // Otherwise use Supabase client
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        throw new Error(error.message)
      }

      return data as UserProfileData | null
    },
    enabled: enabled && !!userId,
    staleTime,
  })
}

// ============ Admin Status Query ============

interface AdminStatusData {
  is_admin: boolean
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

      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      if (error) {
        throw new Error(error.message)
      }

      return {
        is_admin: data?.is_admin || false
      } as AdminStatusData
    },
    enabled: enabled && !!authUserId,
    staleTime,
  })
}
