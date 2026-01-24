/**
 * Dashboard Data Hook
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getDashboardEndpoint } from '@/lib/api-config'
import { fetchApi } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

interface CarrierActive {
  carrier_id: string
  carrier: string
  active_policies: number
}

interface DealsSummary {
  active_policies: number
  monthly_commissions: number
  new_policies: number
  total_clients: number
  carriers_active: CarrierActive[]
}

interface DashboardSummary {
  your_deals: DealsSummary
  downline_production: DealsSummary
  totals: {
    pending_positions: number
  }
}

interface LeaderboardEntry {
  rank: number
  agent_id: string
  name: string
  total: number
  dailyBreakdown: Record<string, number>
  dealCount: number
}

interface ScoreboardData {
  success: boolean
  data?: {
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
  error?: string
}

interface ProductionEntry {
  agent_id: string
  individual_production: number
  individual_production_count: number
  hierarchy_production: number
  hierarchy_production_count: number
}

// ============ Hooks ============

export function useDashboardSummary(
  userId: string | undefined,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<DashboardSummary, Error>({
    queryKey: queryKeys.dashboard(userId || ''),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getDashboardEndpoint('summary'))
      return fetchApi(url.toString(), session.access_token, 'Failed to fetch dashboard summary')
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
  const supabase = createClient()

  return useQuery<ScoreboardData, Error>({
    queryKey: queryKeys.scoreboard(userId || '', startDate, endDate),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getDashboardEndpoint('scoreboard'))
      url.searchParams.set('start_date', startDate)
      url.searchParams.set('end_date', endDate)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch scoreboard data')
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
  const supabase = createClient()

  return useQuery<ProductionEntry[], Error>({
    queryKey: ['production', userId, agentIds.join(','), startDate, endDate],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getDashboardEndpoint('production'))
      url.searchParams.set('agent_ids', agentIds.join(','))
      url.searchParams.set('start_date', startDate)
      url.searchParams.set('end_date', endDate)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch production data')
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
  options?: { enabled?: boolean; staleTime?: number }
) {
  const supabase = createClient()

  return useQuery<ScoreboardData, Error>({
    queryKey: queryKeys.scoreboardBillingCycle(userId || '', startDate, endDate, scope),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getDashboardEndpoint('scoreboardBillingCycle'))
      url.searchParams.set('start_date', startDate)
      url.searchParams.set('end_date', endDate)
      url.searchParams.set('scope', scope)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch scoreboard billing cycle data')
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: options?.staleTime ?? STALE_TIMES.standard,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}
