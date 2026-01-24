/**
 * Dashboard Data Hook
 *
 * Unified hook for fetching dashboard data.
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getDashboardEndpoint } from '@/lib/api-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Constants ============

const STALE_TIME_SHORT = 60 * 1000 // 1 minute
const STALE_TIME_LONG = 5 * 60 * 1000 // 5 minutes

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

// ============ Fetch Functions ============

async function fetchDashboardSummary(
  accessToken: string,
  asOfDate?: string
): Promise<DashboardSummary> {
  const url = new URL(getDashboardEndpoint('summary'))
  if (asOfDate) {
    url.searchParams.set('as_of_date', asOfDate)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard summary')
  }

  return response.json()
}

async function fetchScoreboard(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<ScoreboardData> {
  const url = new URL(getDashboardEndpoint('scoreboard'))
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch scoreboard data')
  }

  return response.json()
}

async function fetchProduction(
  accessToken: string,
  agentIds: string[],
  startDate: string,
  endDate: string
): Promise<ProductionEntry[]> {
  const url = new URL(getDashboardEndpoint('production'))
  url.searchParams.set('agent_ids', agentIds.join(','))
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch production data')
  }

  return response.json()
}

async function fetchScoreboardBillingCycle(
  accessToken: string,
  startDate: string,
  endDate: string,
  scope: 'agency' | 'downline' = 'agency'
): Promise<ScoreboardData> {
  const url = new URL(getDashboardEndpoint('scoreboardBillingCycle'))
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate)
  url.searchParams.set('scope', scope)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch scoreboard billing cycle data')
  }

  return response.json()
}

// ============ Hooks ============

/**
 * Hook for dashboard summary data.
 */
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
      return fetchDashboardSummary(session.access_token)
    },
    enabled: !!userId && (options?.enabled !== false),
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook for scoreboard/leaderboard data.
 */
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
      return fetchScoreboard(session.access_token, startDate, endDate)
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: options?.staleTime ?? STALE_TIME_SHORT,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook for production progress data.
 */
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
      return fetchProduction(session.access_token, agentIds, startDate, endDate)
    },
    enabled: !!userId && agentIds.length > 0 && (options?.enabled !== false),
    staleTime: options?.staleTime ?? STALE_TIME_LONG,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}

/**
 * Hook for scoreboard data with billing cycle payment calculation.
 *
 * This hook fetches scoreboard data from Django backend with proper
 * billing cycle payment calculation.
 */
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
      return fetchScoreboardBillingCycle(session.access_token, startDate, endDate, scope)
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: options?.staleTime ?? STALE_TIME_SHORT,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}
