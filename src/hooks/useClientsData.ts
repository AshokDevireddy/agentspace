/**
 * Clients Data Hook
 *
 * Unified hook for fetching clients data.
 * Switches between Django backend and Next.js API routes based on feature flag.
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { shouldUseDjangoClients } from '@/lib/feature-flags'
import { getClientEndpoint } from '@/lib/api-config'
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

// ============ Fetch Functions ============

async function fetchDjangoClientsList(
  accessToken: string,
  page: number,
  filters: ClientsFilters
): Promise<ClientsListResponse> {
  const url = new URL(getClientEndpoint('list'))
  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', '20')

  // Add filter parameters
  if (filters.view) url.searchParams.set('view', filters.view)
  if (filters.search) url.searchParams.set('search', filters.search)
  if (filters.agent) url.searchParams.set('agent', filters.agent)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch clients')
  }

  return response.json()
}

async function fetchDjangoClientDetail(
  accessToken: string,
  clientId: string
): Promise<ClientDetail> {
  const url = new URL(getClientEndpoint('detail', clientId))

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch client detail')
  }

  return response.json()
}

// ============ Hooks ============

/**
 * Hook for clients list data.
 * Supports both Django backend and Next.js API routes.
 */
export function useClientsList(
  page: number,
  filters: ClientsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoClients()

  return useQuery<ClientsListResponse, Error>({
    queryKey: queryKeys.clientsList(page, filters),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoClientsList(session.access_token, page, filters)
      }

      // Next.js API route fallback
      const params = new URLSearchParams()
      params.append('page', String(page))
      params.append('limit', '20')
      if (filters.view) params.append('view', filters.view)
      if (filters.search) params.append('search', filters.search)
      if (filters.agent) params.append('agent', filters.agent)

      const response = await fetch(`/api/clients?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch clients')
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
 * Hook for all clients (for dropdown selections).
 * Supports both Django backend and Next.js API routes.
 */
export function useAllClients(
  viewMode: string,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoClients()

  return useQuery<ClientsListResponse, Error>({
    queryKey: queryKeys.clientsAll(viewMode),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoClientsList(session.access_token, 1, { view: viewMode })
      }

      // Next.js API route fallback
      const response = await fetch(`/api/clients?page=1&limit=1000&view=${viewMode}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch clients')
      }

      return response.json()
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}

/**
 * Hook for client detail data.
 * Supports both Django backend and Next.js API routes.
 */
export function useClientDetail(
  clientId: string | undefined,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoClients()

  return useQuery<ClientDetail, Error>({
    queryKey: queryKeys.clientDetail(clientId || ''),
    queryFn: async () => {
      if (!clientId) {
        throw new Error('No client ID provided')
      }

      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoClientDetail(session.access_token, clientId)
      }

      // Next.js API route fallback
      const response = await fetch(`/api/clients/${clientId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch client detail')
      }

      return response.json()
    },
    enabled: !!clientId && (options?.enabled !== false),
    staleTime: 60 * 1000, // 1 minute
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}
