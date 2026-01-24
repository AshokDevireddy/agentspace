/**
 * Analytics Data Hook
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getAnalyticsEndpoint } from '@/lib/api-config'
import { fetchApi } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-config'
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

// ============ Helpers ============

function buildAnalyticsFilterParams(filters: AnalyticsFilters, params: URLSearchParams): void {
  if (filters.agentId) params.set('agent_id', filters.agentId)
  if (filters.startDate) params.set('start_date', filters.startDate)
  if (filters.endDate) params.set('end_date', filters.endDate)
  if (filters.groupBy) params.set('group_by', filters.groupBy)
}

// ============ Hooks ============

export function useAnalyticsSplit(
  filters: AnalyticsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<AnalyticsSplitResponse, Error>({
    queryKey: queryKeys.analyticsData({ ...filters, type: 'split' }),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getAnalyticsEndpoint('split'))
      buildAnalyticsFilterParams(filters, url.searchParams)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch analytics split')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.slow,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

export function useDownlineDistribution(
  filters: AnalyticsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<DownlineDistributionResponse, Error>({
    queryKey: queryKeys.analyticsData({ ...filters, type: 'downline' }),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getAnalyticsEndpoint('downlineDistribution'))
      buildAnalyticsFilterParams(filters, url.searchParams)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch downline distribution')
    },
    enabled: !!filters.agentId && (options?.enabled !== false),
    staleTime: STALE_TIMES.slow,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

export function useDealsAnalytics(
  filters: AnalyticsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<DealsAnalyticsResponse, Error>({
    queryKey: queryKeys.analyticsData({ ...filters, type: 'deals' }),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getAnalyticsEndpoint('deals'))
      buildAnalyticsFilterParams(filters, url.searchParams)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch deals analytics')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.slow,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

export function usePersistencyAnalytics(
  filters: AnalyticsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<PersistencyResponse, Error>({
    queryKey: queryKeys.analyticsData({ ...filters, type: 'persistency' }),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getAnalyticsEndpoint('persistency'))
      buildAnalyticsFilterParams(filters, url.searchParams)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch persistency data')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.slow,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}
