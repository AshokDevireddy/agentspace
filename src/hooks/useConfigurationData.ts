/**
 * Configuration Data Hook
 *
 * Migrated to use cookie-based auth via fetchWithCredentials.
 * BFF routes handle auth via httpOnly cookies - no need for manual token passing.
 */
import { useQuery } from '@tanstack/react-query'
import {
  getCarrierEndpoint,
  getProductEndpoint,
  getPositionEndpoint,
} from '@/lib/api-config'
import { fetchWithCredentials } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-config'
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

// ============ Hooks ============

export function useCarriersList(options?: { enabled?: boolean; filter?: string }) {
  return useQuery<CarriersResponse, Error>({
    queryKey: queryKeys.carriersList(options?.filter),
    queryFn: async () => {
      const url = new URL(getCarrierEndpoint('list'))
      return fetchWithCredentials(url.toString(), 'Failed to fetch carriers')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.slow,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}

export function useProductsList(options?: { enabled?: boolean }) {
  return useQuery<ProductsResponse, Error>({
    queryKey: queryKeys.configurationProducts(),
    queryFn: async () => {
      const url = new URL(getProductEndpoint('list'))
      return fetchWithCredentials(url.toString(), 'Failed to fetch products')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.slow,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}

export function usePositionsList(options?: { enabled?: boolean }) {
  return useQuery<PositionsResponse, Error>({
    queryKey: queryKeys.positionsList(),
    queryFn: async () => {
      const url = new URL(getPositionEndpoint('list'))
      return fetchWithCredentials(url.toString(), 'Failed to fetch positions')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.slow,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}

export function useProductCommissions(
  carrierId?: string,
  options?: { enabled?: boolean }
) {
  return useQuery<CommissionsResponse, Error>({
    queryKey: queryKeys.configurationCommissions(carrierId),
    queryFn: async () => {
      const url = new URL(getPositionEndpoint('productCommissions'))
      if (carrierId) {
        url.searchParams.set('carrier_id', carrierId)
      }

      return fetchWithCredentials(url.toString(), 'Failed to fetch commissions')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.slow,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}
