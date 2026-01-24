/**
 * Payouts Data Hook
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getPayoutEndpoint } from '@/lib/api-config'
import { fetchApi } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

export interface PayoutEntry {
  deal_id: string
  policy_number: string | null
  client_name: string | null
  carrier_name: string | null
  product_name: string | null
  agent_name: string | null
  annual_premium: string | null
  expected_commission: string | null
  commission_percentage: string | null
  policy_effective_date: string | null
  status: string | null
}

export interface PayoutsSummary {
  by_carrier: Array<{
    carrier_name: string
    total_premium: number
    total_commission: number
    deal_count: number
  }>
  by_agent: Array<{
    agent_name: string
    total_premium: number
    total_commission: number
    deal_count: number
  }>
}

export interface PayoutsFilters extends Record<string, unknown> {
  agent?: string
  carrier?: string
  product?: string
  startDate?: string
  endDate?: string
}

export interface ExpectedPayoutsResponse {
  payouts: PayoutEntry[]
  total_expected: number
  total_premium: number
  deal_count: number
  summary: PayoutsSummary
}

export interface DebtResponse {
  debt: number
  debt_count: number
  breakdown: Array<{
    agent_name: string
    debt: number
    count: number
  }>
}

// ============ Hooks ============

export function useExpectedPayouts(
  filters: PayoutsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<ExpectedPayoutsResponse, Error>({
    queryKey: queryKeys.expectedPayoutsData(filters),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getPayoutEndpoint('expectedPayouts'))
      if (filters.agent) url.searchParams.set('agent_id', filters.agent)
      if (filters.carrier) url.searchParams.set('carrier', filters.carrier)
      if (filters.product) url.searchParams.set('product', filters.product)
      if (filters.startDate) url.searchParams.set('start_date', filters.startDate)
      if (filters.endDate) url.searchParams.set('end_date', filters.endDate)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch expected payouts')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.medium,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

export function useAgentDebt(
  agentId: string | undefined,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<DebtResponse, Error>({
    queryKey: queryKeys.expectedPayoutsDebt(agentId || ''),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getPayoutEndpoint('debt'))
      url.searchParams.set('agent_id', agentId!)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch debt data')
    },
    enabled: !!agentId && (options?.enabled !== false),
    staleTime: STALE_TIMES.medium,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}
