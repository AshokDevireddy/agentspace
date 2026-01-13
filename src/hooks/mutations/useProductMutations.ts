/**
 * Product-related mutation hooks for TanStack Query
 * Used by configuration page for managing products
 */

import { useAuthenticatedMutation } from '../useMutations'
import { queryKeys } from '../queryKeys'

// Types
interface CreateProductInput {
  carrier_id: string
  name: string
  product_code?: string | null
  is_active: boolean
}

interface CreateProductResponse {
  product: Product
  message?: string
}

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
 * Create a new product
 */
export function useCreateProduct() {
  return useAuthenticatedMutation<CreateProductResponse, CreateProductInput>('/api/products', {
    method: 'POST',
    invalidateKeys: [
      queryKeys.configurationProducts(),
      queryKeys.products,
      queryKeys.configurationCommissionsCarriers(),
    ],
  })
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
      invalidateKeys: [
        queryKeys.configurationProducts(),
        queryKeys.products,
        queryKeys.configurationCommissionsCarriers(),
      ],
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
 * Also invalidates products since commission data is displayed with products
 */
export function useSaveProductCommissions() {
  return useAuthenticatedMutation<void, SaveCommissionsInput>('/api/positions/product-commissions', {
    method: 'POST',
    invalidateKeys: [
      queryKeys.configurationCommissions(),
      queryKeys.configurationProducts(),
      queryKeys.products,
    ],
  })
}

/**
 * Sync missing commissions for a carrier
 * Also invalidates products since commission data is displayed with products
 */
export function useSyncCommissions() {
  return useAuthenticatedMutation<SyncCommissionsResponse, SyncCommissionsInput>(
    (variables) => `/api/positions/product-commissions/sync?carrier_id=${variables.carrierId}`,
    {
      method: 'POST',
      invalidateKeys: [
        queryKeys.configurationCommissions(),
        queryKeys.configurationProducts(),
        queryKeys.products,
      ],
    }
  )
}
