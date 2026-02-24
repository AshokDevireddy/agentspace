/**
 * Analytics Data Hook
 *
 * Migrated to use cookie-based auth via fetchWithCredentials.
 * BFF routes handle auth via httpOnly cookies - no need for manual token passing.
 */
import { useQuery } from '@tanstack/react-query'
import { getAnalyticsEndpoint } from '@/lib/api-config'
import { fetchWithCredentials } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

export interface AgentSplitEntry {
  agentId: string
  agentName: string
  positionName: string | null
  individualProduction: number
  individualCount: number
  hierarchyProduction: number
  hierarchyCount: number
  percentageOfTotal: number
}

export interface DownlineDistributionEntry {
  agentId: string
  agentName: string
  positionName: string | null
  production: number
  dealCount: number
  percentage: number
}

export interface AnalyticsFilters extends Record<string, unknown> {
  agentId?: string
  startDate?: string
  endDate?: string
  view?: string
  groupBy?: string
  leadSource?: string
}

export interface AnalyticsSplitResponse {
  entries: AgentSplitEntry[]
  totals: {
    totalProduction: number
    totalDeals: number
    totalAgents: number
  }
  dateRange: {
    startDate: string
    endDate: string
  }
}

export interface DownlineDistributionResponse {
  entries: DownlineDistributionEntry[]
  totalProduction: number
  totalDeals: number
}

export interface DealsAnalyticsResponse {
  byStatus: Array<{
    status: string
    count: number
    totalPremium: number
  }>
  byCarrier: Array<{
    carrierName: string
    count: number
    totalPremium: number
  }>
  byMonth: Array<{
    month: string
    count: number
    totalPremium: number
  }>
}

export interface PersistencyResponse {
  overallPersistency: number
  byCarrier: Array<{
    carrierName: string
    totalPolicies: number
    activePolicies: number
    persistencyRate: number
  }>
  byAgent: Array<{
    agentName: string
    totalPolicies: number
    activePolicies: number
    persistencyRate: number
  }>
}

// ============ Helpers ============

function buildAnalyticsFilterParams(filters: AnalyticsFilters, params: URLSearchParams): void {
  if (filters.agentId) params.set('agent_id', filters.agentId)
  if (filters.startDate) params.set('start_date', filters.startDate)
  if (filters.endDate) params.set('end_date', filters.endDate)
  if (filters.groupBy) params.set('group_by', filters.groupBy)
  if (filters.leadSource) params.set('lead_source', filters.leadSource)
}

// ============ Hooks ============

export function useAnalyticsSplit(
  filters: AnalyticsFilters,
  options?: { enabled?: boolean }
) {
  return useQuery<AnalyticsSplitResponse, Error>({
    queryKey: queryKeys.analyticsData({ ...filters, type: 'split' }),
    queryFn: async () => {
      const url = new URL(getAnalyticsEndpoint('split'))
      buildAnalyticsFilterParams(filters, url.searchParams)

      return fetchWithCredentials(url.toString(), 'Failed to fetch analytics split')
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
  return useQuery<DownlineDistributionResponse, Error>({
    queryKey: queryKeys.analyticsData({ ...filters, type: 'downline' }),
    queryFn: async () => {
      const url = new URL(getAnalyticsEndpoint('downlineDistribution'))
      buildAnalyticsFilterParams(filters, url.searchParams)

      return fetchWithCredentials(url.toString(), 'Failed to fetch downline distribution')
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
  return useQuery<DealsAnalyticsResponse, Error>({
    queryKey: queryKeys.analyticsData({ ...filters, type: 'deals' }),
    queryFn: async () => {
      const url = new URL(getAnalyticsEndpoint('deals'))
      buildAnalyticsFilterParams(filters, url.searchParams)

      return fetchWithCredentials(url.toString(), 'Failed to fetch deals analytics')
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
  return useQuery<PersistencyResponse, Error>({
    queryKey: queryKeys.analyticsData({ ...filters, type: 'persistency' }),
    queryFn: async () => {
      const url = new URL(getAnalyticsEndpoint('persistency'))
      buildAnalyticsFilterParams(filters, url.searchParams)

      return fetchWithCredentials(url.toString(), 'Failed to fetch persistency data')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.slow,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}
