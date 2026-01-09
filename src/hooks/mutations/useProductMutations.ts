/**
 * Product-related mutation hooks for TanStack Query
 * Used by configuration page for managing products
 */

import { useAuthenticatedMutation } from '../useMutations'
import { queryKeys } from '../queryKeys'

// Types
interface UpdateProductInput {
  productId: string
  name: string
  product_code?: string | null
  is_active: boolean
}

interface DeleteProductInput {
  productId: string
}

interface Product {
  id: string
  carrier_id: string
  agency_id?: string
  name: string
  product_code?: string
  is_active: boolean
  created_at?: string
}

/**
 * Update an existing product
 */
export function useUpdateProduct() {
  return useAuthenticatedMutation<Product, UpdateProductInput>(
    (variables) => `/api/products/${variables.productId}`,
    {
      method: 'PUT',
      invalidateKeys: [queryKeys.configurationProducts(), queryKeys.products],
    }
  )
}

/**
 * Delete a product
 */
export function useDeleteProduct() {
  return useAuthenticatedMutation<void, DeleteProductInput>(
    (variables) => `/api/products/${variables.productId}`,
    {
      method: 'DELETE',
      invalidateKeys: [queryKeys.configurationProducts(), queryKeys.products],
    }
  )
}

// Commission-related types
interface CommissionEntry {
  position_id: string
  product_id: string
  commission_percentage: number
}

interface SaveCommissionsInput {
  commissions: CommissionEntry[]
}

interface SyncCommissionsInput {
  carrierId: string
}

interface SyncCommissionsResponse {
  created: number
}

/**
 * Save product commissions
 */
export function useSaveProductCommissions() {
  return useAuthenticatedMutation<void, SaveCommissionsInput>('/api/positions/product-commissions', {
    method: 'POST',
    invalidateKeys: [queryKeys.configurationCommissions()],
  })
}

/**
 * Sync missing commissions for a carrier
 */
export function useSyncCommissions() {
  return useAuthenticatedMutation<SyncCommissionsResponse, SyncCommissionsInput>(
    (variables) => `/api/positions/product-commissions/sync?carrier_id=${variables.carrierId}`,
    {
      method: 'POST',
      invalidateKeys: [queryKeys.configurationCommissions()],
    }
  )
}
