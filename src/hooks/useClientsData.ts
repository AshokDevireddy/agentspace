/**
 * Clients Data Hook
 *
 * Migrated to use cookie-based auth via fetchWithCredentials.
 * BFF routes handle auth via httpOnly cookies - no need for manual token passing.
 */
import { useQuery } from '@tanstack/react-query'
import { getClientEndpoint } from '@/lib/api-config'
import { fetchWithCredentials } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

export interface Client {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  created_at: string
  deal_count?: number
  total_premium?: number
  agent_name?: string
}

export interface ClientDetail extends Client {
  deals: Array<{
    id: string
    policy_number: string | null
    carrier_name: string | null
    product_name: string | null
    status: string | null
    annual_premium: string | null
    policy_effective_date: string | null
  }>
}

export interface ClientsFilters extends Record<string, unknown> {
  view?: string
  search?: string
  agent?: string
}

export interface Pagination {
  currentPage: number
  totalPages: number
  totalCount: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface ClientsListResponse {
  clients: Client[]
  pagination: Pagination
}

// ============ Hooks ============

export function useClientsList(
  page: number,
  filters: ClientsFilters,
  options?: { enabled?: boolean }
) {
  return useQuery<ClientsListResponse, Error>({
    queryKey: queryKeys.clientsList(page, filters),
    queryFn: async () => {
      const url = new URL(getClientEndpoint('list'))
      url.searchParams.set('page', String(page))
      url.searchParams.set('limit', '20')
      if (filters.view) url.searchParams.set('view', filters.view)
      if (filters.search) url.searchParams.set('search', filters.search)
      if (filters.agent) url.searchParams.set('agent', filters.agent)

      return fetchWithCredentials(url.toString(), 'Failed to fetch clients')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.fast,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

export function useAllClients(
  viewMode: string,
  options?: { enabled?: boolean }
) {
  return useQuery<ClientsListResponse, Error>({
    queryKey: queryKeys.clientsAll(viewMode),
    queryFn: async () => {
      const url = new URL(getClientEndpoint('list'))
      url.searchParams.set('page', '1')
      url.searchParams.set('limit', '1000')
      url.searchParams.set('view', viewMode)

      return fetchWithCredentials(url.toString(), 'Failed to fetch clients')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.slow,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}

export function useClientDetail(
  clientId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<ClientDetail, Error>({
    queryKey: queryKeys.clientDetail(clientId || ''),
    queryFn: async () => {
      const url = new URL(getClientEndpoint('detail', clientId!))
      return fetchWithCredentials(url.toString(), 'Failed to fetch client detail')
    },
    enabled: !!clientId && (options?.enabled !== false),
    staleTime: STALE_TIMES.standard,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}
