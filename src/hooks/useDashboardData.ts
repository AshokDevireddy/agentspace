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
  agentName: string
  position: string | null
  production: string
  dealsCount: number
}

interface ScoreboardData {
  entries: LeaderboardEntry[]
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

// ============ Hooks ============

export function useDashboardSummary(
  userId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<DashboardSummary, Error>({
    queryKey: queryKeys.dashboard(userId || ''),
    queryFn: async () => {
      return apiClient.get<DashboardSummary>('/api/dashboard/summary/')
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
      return apiClient.get<ScoreboardData>('/api/dashboard/scoreboard/', {
        params: { start_date: startDate, end_date: endDate },
      })
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
      return apiClient.get<ProductionEntry[]>('/api/dashboard/production/', {
        params: {
          agent_ids: agentIds.join(','),
          start_date: startDate,
          end_date: endDate,
        },
      })
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
      if (dateMode) {
        params.date_mode = dateMode
      }
      if (assumedMonthsTillLapse !== undefined) {
        params.assumed_months_till_lapse = assumedMonthsTillLapse
      }

      const raw = await apiClient.get<{ success: boolean; data: BillingCycleScoreboardData } | BillingCycleScoreboardData>('/api/dashboard/scoreboard-billing-cycle/', { params })
      // Backend wraps response in { success, data } — unwrap it
      return ('data' in raw && raw.data && typeof raw.data === 'object' ? raw.data : raw) as BillingCycleScoreboardData
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: options?.staleTime ?? STALE_TIMES.standard,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}
