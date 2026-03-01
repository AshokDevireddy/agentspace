/**
 * Dashboard Data Hook
 *
 * Uses apiClient for direct backend calls with JWT auth.
 * apiClient automatically unwraps Django {success, data} envelopes and camelCases responses.
 */
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

interface CarrierActive {
  carrierId: string
  carrier: string
  activePolicies: number
}

interface DealsSummary {
  activePolicies: number
  monthlyCommissions: number
  newPolicies: number
  totalClients: number
  carriersActive: CarrierActive[]
}

interface DashboardSummary {
  yourDeals: DealsSummary
  downlineProduction: DealsSummary
  totals: {
    pendingPositions: number
  }
}

interface ScoreboardEntry {
  rank: number
  agentId: string
  agentName: string
  production: string
  dealsCount: number
  position?: string | null
}

interface ScoreboardData {
  entries: ScoreboardEntry[]
  userRank: number | null
  userProduction: string | null
}

interface BillingCycleAgentScore {
  rank: number
  agentId: string
  name: string
  total: number
  dailyBreakdown: { [date: string]: number }
  dealCount: number
}

export interface BillingCycleScoreboardData {
  leaderboard: BillingCycleAgentScore[]
  stats: {
    totalProduction: number
    totalDeals: number
    activeAgents: number
  }
  dateRange: {
    startDate: string
    endDate: string
  }
}

interface ProductionEntry {
  agentId: string
  individualProduction: number
  individualProductionCount: number
  hierarchyProduction: number
  hierarchyProductionCount: number
}

interface RawLeaderboardEntry {
  rank: number
  agentId: string
  name: string
  total: number
  dealCount: number
  position?: string | null
}

// ============ Helpers ============

/** psycopg2 may return json_agg results as a raw JSON string instead of a parsed array */
function ensureArray<T>(value: T[] | string | null | undefined): T[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T[] } catch { return [] }
  }
  return []
}

function normalizeDealsSummary(deals: DealsSummary): DealsSummary {
  return { ...deals, carriersActive: ensureArray<CarrierActive>(deals.carriersActive) }
}

// ============ Hooks ============

export function useDashboardSummary(
  userId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<DashboardSummary, Error>({
    queryKey: queryKeys.dashboard(userId || ''),
    queryFn: async () => {
      const data = await apiClient.get<DashboardSummary>('/api/dashboard/summary/')
      return {
        ...data,
        yourDeals: normalizeDealsSummary(data.yourDeals),
        downlineProduction: normalizeDealsSummary(data.downlineProduction),
      }
    },
    enabled: !!userId && (options?.enabled !== false),
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

export function useScoreboardData(
  userId: string | undefined,
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean; staleTime?: number; scope?: 'agency' | 'team'; dateMode?: string }
) {
  const scope = options?.scope
  const dateMode = options?.dateMode
  return useQuery<ScoreboardData, Error>({
    queryKey: queryKeys.scoreboard(userId || '', startDate, endDate, scope, dateMode),
    queryFn: async () => {
      const params: Record<string, string> = { start_date: startDate, end_date: endDate }
      if (scope) params.scope = scope
      if (dateMode) params.date_mode = dateMode
      return apiClient.get<ScoreboardData>('/api/dashboard/scoreboard/', { params })
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: options?.staleTime ?? STALE_TIMES.standard,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

export function useProductionData(
  userId: string | undefined,
  agentIds: string[],
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean; staleTime?: number },
  dateMode?: string,
) {
  const agentIdsKey = agentIds.join(',')
  return useQuery<ProductionEntry[], Error>({
    queryKey: queryKeys.production(userId || '', agentIdsKey, startDate, endDate, dateMode),
    queryFn: async () => {
      const params: Record<string, string> = {
        agent_ids: agentIdsKey,
        start_date: startDate,
        end_date: endDate,
      }
      if (dateMode) params.date_mode = dateMode
      return apiClient.get<ProductionEntry[]>('/api/dashboard/production/', { params })
    },
    enabled: !!userId && agentIds.length > 0 && (options?.enabled !== false),
    staleTime: options?.staleTime ?? STALE_TIMES.slow,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}

export function useScoreboardLapsedData(
  userId: string | undefined,
  startDate: string,
  endDate: string,
  scope: 'agency' | 'downline' = 'agency',
  options?: { enabled?: boolean; staleTime?: number },
  submitted: boolean = true,
  dateMode?: string,
  assumedMonthsTillLapse?: number,
) {
  return useQuery<BillingCycleScoreboardData, Error>({
    queryKey: queryKeys.scoreboardLapsed(userId || '', startDate, endDate, scope, submitted, dateMode, assumedMonthsTillLapse),
    queryFn: async () => {
      const params: Record<string, string | number> = {
        start_date: startDate,
        end_date: endDate,
        scope,
        submitted: submitted ? 'true' : 'false',
      }
      if (dateMode) params.date_mode = dateMode
      if (assumedMonthsTillLapse !== undefined) params.assumed_months_till_lapse = assumedMonthsTillLapse
      return apiClient.get<BillingCycleScoreboardData>('/api/dashboard/scoreboard-lapsed/', { params })
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: options?.staleTime ?? STALE_TIMES.standard,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

export function useScoreboardBillingCycleData(
  userId: string | undefined,
  startDate: string,
  endDate: string,
  scope: 'agency' | 'downline' = 'agency',
  options?: { enabled?: boolean; staleTime?: number },
  dateMode?: string,
  assumedMonthsTillLapse?: number,
) {
  return useQuery<BillingCycleScoreboardData, Error>({
    queryKey: queryKeys.scoreboardBillingCycle(userId || '', startDate, endDate, scope, dateMode, assumedMonthsTillLapse),
    queryFn: async () => {
      const params: Record<string, string | number> = {
        start_date: startDate,
        end_date: endDate,
        scope,
      }
      if (dateMode) params.date_mode = dateMode
      if (assumedMonthsTillLapse !== undefined) params.assumed_months_till_lapse = assumedMonthsTillLapse

      return apiClient.get<BillingCycleScoreboardData>('/api/dashboard/scoreboard-billing-cycle/', { params })
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: options?.staleTime ?? STALE_TIMES.standard,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}
