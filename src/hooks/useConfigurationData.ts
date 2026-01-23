/**
 * Configuration Data Hook
 *
 * Unified hook for fetching configuration data (carriers, products, positions).
 * Switches between Django backend and Next.js API routes based on feature flag.
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  shouldUseDjangoCarriers,
  shouldUseDjangoProducts,
  shouldUseDjangoPositions,
} from '@/lib/feature-flags'
import {
  getDjangoCarrierEndpoint,
  getDjangoProductEndpoint,
  getDjangoPositionEndpoint,
} from '@/lib/api-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

export interface Carrier {
  id: string
  name: string
  code: string | null
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  name: string
  carrier_id: string
  carrier_name: string
  is_active: boolean
  created_at: string
}

export interface Position {
  id: string
  name: string
  description: string | null
  level: number
  is_active: boolean
  created_at: string
}

export interface ProductCommission {
  id: string
  position_id: string
  position_name: string
  product_id: string
  product_name: string
  carrier_name: string
  commission_percentage: string
}

export interface CarriersResponse {
  carriers: Carrier[]
}

export interface ProductsResponse {
  products: Product[]
}

export interface PositionsResponse {
  positions: Position[]
}

export interface CommissionsResponse {
  commissions: ProductCommission[]
}

// ============ Fetch Functions ============

async function fetchDjangoCarriers(accessToken: string): Promise<CarriersResponse> {
  const url = new URL(getDjangoCarrierEndpoint('list'))

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch carriers')
  }

  return response.json()
}

async function fetchDjangoProducts(accessToken: string): Promise<ProductsResponse> {
  const url = new URL(getDjangoProductEndpoint('list'))

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch products')
  }

  return response.json()
}

async function fetchDjangoPositions(accessToken: string): Promise<PositionsResponse> {
  const url = new URL(getDjangoPositionEndpoint('list'))

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch positions')
  }

  return response.json()
}

async function fetchDjangoCommissions(
  accessToken: string,
  carrierId?: string
): Promise<CommissionsResponse> {
  const url = new URL(getDjangoPositionEndpoint('productCommissions'))
  if (carrierId) {
    url.searchParams.set('carrier_id', carrierId)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch commissions')
  }

  return response.json()
}

// ============ Hooks ============

/**
 * Hook for carriers list.
 * Supports both Django backend and Next.js API routes.
 */
export function useCarriersList(options?: { enabled?: boolean; filter?: string }) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoCarriers()

  return useQuery<CarriersResponse, Error>({
    queryKey: queryKeys.carriersList(options?.filter),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoCarriers(session.access_token)
      }

      // Next.js API route fallback
      const params = new URLSearchParams()
      if (options?.filter) params.append('filter', options.filter)

      const response = await fetch(`/api/carriers?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch carriers')
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
 * Hook for products list.
 * Supports both Django backend and Next.js API routes.
 */
export function useProductsList(options?: { enabled?: boolean }) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoProducts()

  return useQuery<ProductsResponse, Error>({
    queryKey: queryKeys.configurationProducts(),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoProducts(session.access_token)
      }

      // Next.js API route fallback
      const response = await fetch('/api/products', {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch products')
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
 * Hook for positions list.
 * Supports both Django backend and Next.js API routes.
 */
export function usePositionsList(options?: { enabled?: boolean }) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoPositions()

  return useQuery<PositionsResponse, Error>({
    queryKey: queryKeys.positionsList(),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoPositions(session.access_token)
      }

      // Next.js API route fallback
      const response = await fetch('/api/positions', {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch positions')
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
 * Hook for product commissions.
 * Supports both Django backend and Next.js API routes.
 */
export function useProductCommissions(
  carrierId?: string,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoPositions()

  return useQuery<CommissionsResponse, Error>({
    queryKey: queryKeys.configurationCommissions(carrierId),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoCommissions(session.access_token, carrierId)
      }

      // Next.js API route fallback
      const params = new URLSearchParams()
      if (carrierId) params.append('carrierId', carrierId)

      const response = await fetch(`/api/positions/product-commissions?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch commissions')
      }

      return response.json()
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}
