/**
 * Deals Data Hook
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getDealEndpoint } from '@/lib/api-config'
import { fetchApi } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

export interface Deal {
  id: string
  policy_number: string | null
  status: string | null
  status_standardized: string | null
  agent_id: string | null
  agent_name: string | null
  client_id: string | null
  client_name: string | null
  carrier_id: string | null
  carrier_name: string | null
  product_id: string | null
  product_name: string | null
  annual_premium: string | null
  monthly_premium: string | null
  policy_effective_date: string | null
  submission_date: string | null
  created_at: string
}

export interface DealsFilters extends Record<string, unknown> {
  carrier?: string
  product?: string
  agent?: string
  status?: string
  statusStandardized?: string
  search?: string
  cursor?: string
  policyEffectiveDateStart?: string
  policyEffectiveDateEnd?: string
  submissionDateStart?: string
  submissionDateEnd?: string
}

export interface BookOfBusinessResponse {
  deals: Deal[]
  has_more: boolean
  next_cursor: string | null
  total_count?: number
}

export interface FilterOption {
  id: string
  name: string
}

export interface FilterOptionsResponse {
  carriers: FilterOption[]
  products: FilterOption[]
  statuses: string[]
  statuses_standardized: string[]
  agents: FilterOption[]
}

// ============ Helpers ============

function buildDealsFilterParams(filters: DealsFilters, params: URLSearchParams): void {
  if (filters.carrier) params.set('carrier', filters.carrier)
  if (filters.product) params.set('product', filters.product)
  if (filters.agent) params.set('agent', filters.agent)
  if (filters.status) params.set('status', filters.status)
  if (filters.statusStandardized) params.set('status_standardized', filters.statusStandardized)
  if (filters.search) params.set('search', filters.search)
  if (filters.cursor) params.set('cursor', filters.cursor)
  if (filters.policyEffectiveDateStart) params.set('policy_effective_date_start', filters.policyEffectiveDateStart)
  if (filters.policyEffectiveDateEnd) params.set('policy_effective_date_end', filters.policyEffectiveDateEnd)
  if (filters.submissionDateStart) params.set('submission_date_start', filters.submissionDateStart)
  if (filters.submissionDateEnd) params.set('submission_date_end', filters.submissionDateEnd)
}

// ============ Hooks ============

export function useBookOfBusiness(
  filters: DealsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<BookOfBusinessResponse, Error>({
    queryKey: queryKeys.dealsBookOfBusiness(filters),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getDealEndpoint('bookOfBusiness'))
      buildDealsFilterParams(filters, url.searchParams)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch deals')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.fast,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

export function useDealsFilterOptions(options?: { enabled?: boolean }) {
  const supabase = createClient()

  return useQuery<FilterOptionsResponse, Error>({
    queryKey: queryKeys.dealsFilterOptions(),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getDealEndpoint('filterOptions'))
      return fetchApi(url.toString(), session.access_token, 'Failed to fetch filter options')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.static,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}
