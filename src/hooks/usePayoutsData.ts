/**
 * Payouts Data Hook
 *
 * Unified hook for fetching expected payouts data.
 * Switches between Django backend and Next.js API routes based on feature flag.
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { shouldUseDjangoPayouts } from '@/lib/feature-flags'
import { getPayoutEndpoint } from '@/lib/api-config'
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

// ============ Fetch Functions ============

async function fetchDjangoExpectedPayouts(
  accessToken: string,
  filters: PayoutsFilters
): Promise<ExpectedPayoutsResponse> {
  const url = new URL(getPayoutEndpoint('expectedPayouts'))

  // Add filter parameters
  if (filters.agent) url.searchParams.set('agent_id', filters.agent)
  if (filters.carrier) url.searchParams.set('carrier', filters.carrier)
  if (filters.product) url.searchParams.set('product', filters.product)
  if (filters.startDate) url.searchParams.set('start_date', filters.startDate)
  if (filters.endDate) url.searchParams.set('end_date', filters.endDate)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch expected payouts')
  }

  return response.json()
}

async function fetchDjangoDebt(
  accessToken: string,
  agentId: string
): Promise<DebtResponse> {
  const url = new URL(getPayoutEndpoint('debt'))
  url.searchParams.set('agent_id', agentId)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch debt data')
  }

  return response.json()
}

// ============ Hooks ============

/**
 * Hook for expected payouts data.
 * Supports both Django backend and Next.js API routes.
 */
export function useExpectedPayouts(
  filters: PayoutsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoPayouts()

  return useQuery<ExpectedPayoutsResponse, Error>({
    queryKey: queryKeys.expectedPayoutsData(filters),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      if (useDjango) {
        return fetchDjangoExpectedPayouts(session.access_token, filters)
      }

      // Next.js API route fallback
      const params = new URLSearchParams()
      if (filters.agent) params.append('agentId', filters.agent)
      if (filters.carrier) params.append('carrier', filters.carrier)
      if (filters.product) params.append('product', filters.product)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const response = await fetch(`/api/expected-payouts?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch expected payouts')
      }

      return response.json()
    },
    enabled: options?.enabled !== false,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook for agent debt data.
 * Supports both Django backend and Next.js API routes.
 */
export function useAgentDebt(
  agentId: string | undefined,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoPayouts()

  return useQuery<DebtResponse, Error>({
    queryKey: queryKeys.expectedPayoutsDebt(agentId || ''),
    queryFn: async () => {
      if (!agentId) {
        throw new Error('No agent ID provided')
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      if (useDjango) {
        return fetchDjangoDebt(session.access_token, agentId)
      }

      // Next.js API route fallback
      const response = await fetch(`/api/expected-payouts/debt?agentId=${agentId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch debt data')
      }

      const data = await response.json()
      return data
    },
    enabled: !!agentId && (options?.enabled !== false),
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}
