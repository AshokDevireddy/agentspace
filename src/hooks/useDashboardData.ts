/**
 * Dashboard Data Hook
 *
 * Unified hook for fetching dashboard data.
 * Switches between Django backend and Supabase RPC based on feature flag.
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { shouldUseDjangoDashboard } from '@/lib/feature-flags'
import { getDjangoDashboardEndpoint } from '@/lib/api-config'
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

// ============ Fetch Functions ============

async function fetchDjangoDashboardSummary(
  accessToken: string,
  asOfDate?: string
): Promise<DashboardSummary> {
  const url = new URL(getDjangoDashboardEndpoint('summary'))
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

async function fetchDjangoScoreboard(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<ScoreboardData> {
  const url = new URL(getDjangoDashboardEndpoint('scoreboard'))
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

async function fetchDjangoProduction(
  accessToken: string,
  agentIds: string[],
  startDate: string,
  endDate: string
): Promise<ProductionEntry[]> {
  const url = new URL(getDjangoDashboardEndpoint('production'))
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

// ============ Hooks ============

/**
 * Hook for dashboard summary data.
 * Mirrors: get_dashboard_data_with_agency_id RPC
 */
export function useDashboardSummary(
  userId: string | undefined,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoDashboard()

  return useQuery<DashboardSummary, Error>({
    queryKey: queryKeys.dashboard(userId || ''),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoDashboardSummary(session.access_token)
      }

      // Supabase RPC fallback
      const { data, error } = await supabase.rpc('get_dashboard_data_with_agency_id', {
        p_user_id: userId,
      })

      if (error) throw error
      return data as DashboardSummary
    },
    enabled: !!userId && (options?.enabled !== false),
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook for scoreboard/leaderboard data.
 * Mirrors: get_scoreboard_data RPC
 */
export function useScoreboardData(
  userId: string | undefined,
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean; staleTime?: number }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoDashboard()

  return useQuery<ScoreboardData, Error>({
    queryKey: queryKeys.scoreboard(userId || '', startDate, endDate),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoScoreboard(session.access_token, startDate, endDate)
      }

      // Supabase RPC fallback
      const { data, error } = await supabase.rpc('get_scoreboard_data', {
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate,
      })

      if (error) throw error
      return data as ScoreboardData
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: options?.staleTime ?? 60 * 1000, // 1 minute default
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook for production progress data.
 * Mirrors: get_agents_debt_production RPC
 */
export function useProductionData(
  userId: string | undefined,
  agentIds: string[],
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean; staleTime?: number }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoDashboard()

  return useQuery<ProductionEntry[], Error>({
    queryKey: ['production', userId, agentIds.join(','), startDate, endDate],
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoProduction(session.access_token, agentIds, startDate, endDate)
      }

      // Supabase RPC fallback
      const { data, error } = await supabase.rpc('get_agents_debt_production', {
        p_user_id: userId,
        p_agent_ids: agentIds,
        p_start_date: startDate,
        p_end_date: endDate,
      })

      if (error) throw error
      return data as ProductionEntry[]
    },
    enabled: !!userId && agentIds.length > 0 && (options?.enabled !== false),
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes default
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}
