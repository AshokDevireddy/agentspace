/**
 * Deals Data Hook
 *
 * Unified hook for fetching deals data (book of business, filter options).
 * Switches between Django backend and Next.js API routes based on feature flag.
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { shouldUseDjangoDealsBob, shouldUseDjangoDealsFilters } from '@/lib/feature-flags'
import { getDjangoDealEndpoint } from '@/lib/api-config'
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

// ============ Fetch Functions ============

async function fetchDjangoBookOfBusiness(
  accessToken: string,
  filters: DealsFilters
): Promise<BookOfBusinessResponse> {
  const url = new URL(getDjangoDealEndpoint('bookOfBusiness'))

  // Add filter parameters
  if (filters.carrier) url.searchParams.set('carrier', filters.carrier)
  if (filters.product) url.searchParams.set('product', filters.product)
  if (filters.agent) url.searchParams.set('agent', filters.agent)
  if (filters.status) url.searchParams.set('status', filters.status)
  if (filters.statusStandardized) url.searchParams.set('status_standardized', filters.statusStandardized)
  if (filters.search) url.searchParams.set('search', filters.search)
  if (filters.cursor) url.searchParams.set('cursor', filters.cursor)
  if (filters.policyEffectiveDateStart) url.searchParams.set('policy_effective_date_start', filters.policyEffectiveDateStart)
  if (filters.policyEffectiveDateEnd) url.searchParams.set('policy_effective_date_end', filters.policyEffectiveDateEnd)
  if (filters.submissionDateStart) url.searchParams.set('submission_date_start', filters.submissionDateStart)
  if (filters.submissionDateEnd) url.searchParams.set('submission_date_end', filters.submissionDateEnd)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch deals')
  }

  return response.json()
}

async function fetchDjangoFilterOptions(
  accessToken: string
): Promise<FilterOptionsResponse> {
  const url = new URL(getDjangoDealEndpoint('filterOptions'))

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch filter options')
  }

  return response.json()
}

// ============ Hooks ============

/**
 * Hook for book of business data (deals list with keyset pagination).
 * Supports both Django backend and Next.js API routes.
 */
export function useBookOfBusiness(
  filters: DealsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoDealsBob()

  return useQuery<BookOfBusinessResponse, Error>({
    queryKey: queryKeys.dealsBookOfBusiness(filters),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoBookOfBusiness(session.access_token, filters)
      }

      // Next.js API route fallback
      const params = new URLSearchParams()
      if (filters.carrier) params.append('carrier', filters.carrier)
      if (filters.product) params.append('product', filters.product)
      if (filters.agent) params.append('agent', filters.agent)
      if (filters.status) params.append('status', filters.status)
      if (filters.statusStandardized) params.append('statusStandardized', filters.statusStandardized)
      if (filters.search) params.append('search', filters.search)
      if (filters.cursor) params.append('cursor', filters.cursor)
      if (filters.policyEffectiveDateStart) params.append('policyEffectiveDateStart', filters.policyEffectiveDateStart)
      if (filters.policyEffectiveDateEnd) params.append('policyEffectiveDateEnd', filters.policyEffectiveDateEnd)
      if (filters.submissionDateStart) params.append('submissionDateStart', filters.submissionDateStart)
      if (filters.submissionDateEnd) params.append('submissionDateEnd', filters.submissionDateEnd)

      const response = await fetch(`/api/deals/book-of-business?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch deals')
      }

      return response.json()
    },
    enabled: options?.enabled !== false,
    staleTime: 30 * 1000, // 30 seconds
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook for filter options data.
 * Supports both Django backend and Next.js API routes.
 */
export function useDealsFilterOptions(options?: { enabled?: boolean }) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoDealsFilters()

  return useQuery<FilterOptionsResponse, Error>({
    queryKey: queryKeys.dealsFilterOptions(),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoFilterOptions(session.access_token)
      }

      // Next.js API route fallback
      const response = await fetch('/api/deals/filter-options', {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch filter options')
      }

      return response.json()
    },
    enabled: options?.enabled !== false,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}
