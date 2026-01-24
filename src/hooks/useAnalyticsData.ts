/**
 * Analytics Data Hook
 *
 * Unified hook for fetching analytics data.
 * Switches between Django backend and Supabase RPC based on feature flag.
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { shouldUseDjangoAnalytics } from '@/lib/feature-flags'
import { getAnalyticsEndpoint } from '@/lib/api-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

export interface AgentSplitEntry {
  agent_id: string
  agent_name: string
  position_name: string | null
  individual_production: number
  individual_count: number
  hierarchy_production: number
  hierarchy_count: number
  percentage_of_total: number
}

export interface DownlineDistributionEntry {
  agent_id: string
  agent_name: string
  position_name: string | null
  production: number
  deal_count: number
  percentage: number
}

export interface AnalyticsFilters extends Record<string, unknown> {
  agentId?: string
  startDate?: string
  endDate?: string
  view?: string
  groupBy?: string
}

export interface AnalyticsSplitResponse {
  entries: AgentSplitEntry[]
  totals: {
    total_production: number
    total_deals: number
    total_agents: number
  }
  date_range: {
    start_date: string
    end_date: string
  }
}

export interface DownlineDistributionResponse {
  entries: DownlineDistributionEntry[]
  total_production: number
  total_deals: number
}

export interface DealsAnalyticsResponse {
  by_status: Array<{
    status: string
    count: number
    total_premium: number
  }>
  by_carrier: Array<{
    carrier_name: string
    count: number
    total_premium: number
  }>
  by_month: Array<{
    month: string
    count: number
    total_premium: number
  }>
}

export interface PersistencyResponse {
  overall_persistency: number
  by_carrier: Array<{
    carrier_name: string
    total_policies: number
    active_policies: number
    persistency_rate: number
  }>
  by_agent: Array<{
    agent_name: string
    total_policies: number
    active_policies: number
    persistency_rate: number
  }>
}

// ============ Fetch Functions ============

async function fetchDjangoAnalyticsSplit(
  accessToken: string,
  filters: AnalyticsFilters
): Promise<AnalyticsSplitResponse> {
  const url = new URL(getAnalyticsEndpoint('split'))

  // Add filter parameters
  if (filters.agentId) url.searchParams.set('agent_id', filters.agentId)
  if (filters.startDate) url.searchParams.set('start_date', filters.startDate)
  if (filters.endDate) url.searchParams.set('end_date', filters.endDate)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch analytics split')
  }

  return response.json()
}

async function fetchDjangoDownlineDistribution(
  accessToken: string,
  filters: AnalyticsFilters
): Promise<DownlineDistributionResponse> {
  const url = new URL(getAnalyticsEndpoint('downlineDistribution'))

  // Add filter parameters
  if (filters.agentId) url.searchParams.set('agent_id', filters.agentId)
  if (filters.startDate) url.searchParams.set('start_date', filters.startDate)
  if (filters.endDate) url.searchParams.set('end_date', filters.endDate)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch downline distribution')
  }

  return response.json()
}

async function fetchDjangoDealsAnalytics(
  accessToken: string,
  filters: AnalyticsFilters
): Promise<DealsAnalyticsResponse> {
  const url = new URL(getAnalyticsEndpoint('deals'))

  // Add filter parameters
  if (filters.agentId) url.searchParams.set('agent_id', filters.agentId)
  if (filters.startDate) url.searchParams.set('start_date', filters.startDate)
  if (filters.endDate) url.searchParams.set('end_date', filters.endDate)
  if (filters.groupBy) url.searchParams.set('group_by', filters.groupBy)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch deals analytics')
  }

  return response.json()
}

async function fetchDjangoPersistency(
  accessToken: string,
  filters: AnalyticsFilters
): Promise<PersistencyResponse> {
  const url = new URL(getAnalyticsEndpoint('persistency'))

  // Add filter parameters
  if (filters.agentId) url.searchParams.set('agent_id', filters.agentId)
  if (filters.startDate) url.searchParams.set('start_date', filters.startDate)
  if (filters.endDate) url.searchParams.set('end_date', filters.endDate)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch persistency data')
  }

  return response.json()
}

// ============ Hooks ============

/**
 * Hook for analytics split data (agent production breakdown).
 * Supports both Django backend and Supabase RPC.
 */
export function useAnalyticsSplit(
  filters: AnalyticsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoAnalytics()

  return useQuery<AnalyticsSplitResponse, Error>({
    queryKey: queryKeys.analyticsData({ ...filters, type: 'split' }),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoAnalyticsSplit(session.access_token, filters)
      }

      // Supabase RPC fallback
      const { data, error } = await supabase.rpc('get_analytics_split_view', {
        p_user_id: filters.agentId,
        p_start_date: filters.startDate,
        p_end_date: filters.endDate,
      })

      if (error) throw error
      return data as AnalyticsSplitResponse
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook for downline distribution data.
 * Supports both Django backend and Supabase RPC.
 */
export function useDownlineDistribution(
  filters: AnalyticsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoAnalytics()

  return useQuery<DownlineDistributionResponse, Error>({
    queryKey: queryKeys.analyticsData({ ...filters, type: 'downline' }),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoDownlineDistribution(session.access_token, filters)
      }

      // Supabase RPC fallback
      const { data, error } = await supabase.rpc('get_downline_distribution', {
        p_user_id: filters.agentId,
        p_start_date: filters.startDate,
        p_end_date: filters.endDate,
      })

      if (error) throw error
      return data as DownlineDistributionResponse
    },
    enabled: !!filters.agentId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook for deals analytics data.
 * Supports both Django backend and Supabase RPC.
 */
export function useDealsAnalytics(
  filters: AnalyticsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoAnalytics()

  return useQuery<DealsAnalyticsResponse, Error>({
    queryKey: queryKeys.analyticsData({ ...filters, type: 'deals' }),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoDealsAnalytics(session.access_token, filters)
      }

      // Supabase RPC fallback
      const { data, error } = await supabase.rpc('get_deals_analytics', {
        p_user_id: filters.agentId,
        p_start_date: filters.startDate,
        p_end_date: filters.endDate,
        p_group_by: filters.groupBy,
      })

      if (error) throw error
      return data as DealsAnalyticsResponse
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook for persistency analytics data.
 * Supports both Django backend and Supabase RPC.
 */
export function usePersistencyAnalytics(
  filters: AnalyticsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoAnalytics()

  return useQuery<PersistencyResponse, Error>({
    queryKey: queryKeys.analyticsData({ ...filters, type: 'persistency' }),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoPersistency(session.access_token, filters)
      }

      // Supabase RPC fallback
      const { data, error } = await supabase.rpc('get_persistency_analytics', {
        p_user_id: filters.agentId,
        p_start_date: filters.startDate,
        p_end_date: filters.endDate,
      })

      if (error) throw error
      return data as PersistencyResponse
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}
