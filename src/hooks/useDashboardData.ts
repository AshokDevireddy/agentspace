/**
 * Dashboard Data Hook
 *
 * Uses apiClient for direct backend calls with JWT auth.
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

interface LeaderboardEntry {
  rank: number
  agentId: string
  name: string
  total: number
  dailyBreakdown: Record<string, number>
  dealCount: number
}

interface ScoreboardData {
  leaderboard: LeaderboardEntry[]
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

interface RawScoreboardEnvelope {
  success: boolean
  data: {
    leaderboard: RawLeaderboardEntry[]
    userRank?: number | null
    userProduction?: number | null
  }
}

// ============ Helpers ============

/**
 * Unwrap a Django {success, data} envelope if present, otherwise return as-is.
 * psycopg2 may also return json_agg fields as raw JSON strings — ensureArray handles that.
 */
function unwrapEnvelope<T>(raw: unknown): T {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'success' in (raw as object) &&
    'data' in (raw as object)
  ) {
    return (raw as { success: boolean; data: T }).data
  }
  return raw as T
}

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
      const raw = await apiClient.get<DashboardSummary | { success: boolean; data: DashboardSummary }>('/api/dashboard/summary/')
      const data = unwrapEnvelope<DashboardSummary>(raw)
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
  options?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery<ScoreboardData, Error>({
    queryKey: queryKeys.scoreboard(userId || '', startDate, endDate),
    queryFn: async () => {
      const raw = await apiClient.get<RawScoreboardEnvelope | RawScoreboardEnvelope['data']>('/api/dashboard/scoreboard/', {
        params: { start_date: startDate, end_date: endDate },
      })
      const inner = unwrapEnvelope<RawScoreboardEnvelope['data']>(raw)

      return {
        entries: ensureArray<RawLeaderboardEntry>(inner?.leaderboard).map((entry) => ({
          rank: entry.rank,
          agentId: entry.agentId,
          agentName: entry.name,
          production: String(entry.total),
          dealsCount: entry.dealCount,
          position: entry.position ?? null,
        })),
        userRank: inner?.userRank ?? null,
        userProduction: inner?.userProduction != null ? String(inner.userProduction) : null,
      }
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
  options?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery<ProductionEntry[], Error>({
    queryKey: ['production', userId, agentIds.join(','), startDate, endDate],
    queryFn: async () => {
      const raw = await apiClient.get<ProductionEntry[] | { success: boolean; data: ProductionEntry[] }>('/api/dashboard/production/', {
        params: {
          agent_ids: agentIds.join(','),
          start_date: startDate,
          end_date: endDate,
        },
      })
      // Production returns a plain array; unwrap envelope only if present
      const data = Array.isArray(raw) ? raw : unwrapEnvelope<ProductionEntry[]>(raw)
      return ensureArray<ProductionEntry>(data as ProductionEntry[] | string)
    },
    enabled: !!userId && agentIds.length > 0 && (options?.enabled !== false),
    staleTime: options?.staleTime ?? STALE_TIMES.slow,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
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
      const params: Record<string, string | number | boolean | undefined | null> = {
        start_date: startDate,
        end_date: endDate,
        scope,
      }
      if (dateMode) params.date_mode = dateMode
      if (assumedMonthsTillLapse !== undefined) params.assumed_months_till_lapse = assumedMonthsTillLapse

      const raw = await apiClient.get<BillingCycleScoreboardData | { success: boolean; data: BillingCycleScoreboardData }>('/api/dashboard/scoreboard-billing-cycle/', { params })
      return unwrapEnvelope<BillingCycleScoreboardData>(raw)
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: options?.staleTime ?? STALE_TIMES.standard,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}
