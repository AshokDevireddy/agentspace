/**
 * Dashboard Data Hook
 *
 * Uses Next.js API routes which proxy to Django backend with httpOnly cookie auth.
 */
import { useQuery } from '@tanstack/react-query'
import { STALE_TIMES } from '@/lib/query-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

/**
 * Fetch from local Next.js API route with credentials (cookies)
 */
async function fetchWithCookies<T>(url: string, errorMessage: string): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.message || errorMessage)
  }

  return response.json()
}

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
      return fetchWithCookies('/api/dashboard/summary', 'Failed to fetch dashboard summary')
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
      const url = new URL('/api/scoreboard', window.location.origin)
      url.searchParams.set('startDate', startDate)
      url.searchParams.set('endDate', endDate)

      return fetchWithCookies(url.toString(), 'Failed to fetch scoreboard data')
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
      const url = new URL('/api/dashboard/production', window.location.origin)
      url.searchParams.set('agent_ids', agentIds.join(','))
      url.searchParams.set('start_date', startDate)
      url.searchParams.set('end_date', endDate)

      return fetchWithCookies(url.toString(), 'Failed to fetch production data')
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
      const url = new URL('/api/dashboard/scoreboard-billing-cycle', window.location.origin)
      url.searchParams.set('start_date', startDate)
      url.searchParams.set('end_date', endDate)
      url.searchParams.set('scope', scope)
      if (dateMode) {
        url.searchParams.set('date_mode', dateMode)
      }
      if (assumedMonthsTillLapse !== undefined) {
        url.searchParams.set('assumed_months_till_lapse', String(assumedMonthsTillLapse))
      }

      return fetchWithCookies(url.toString(), 'Failed to fetch scoreboard billing cycle data')
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: options?.staleTime ?? STALE_TIMES.standard,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}
