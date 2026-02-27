/**
 * Product-related mutation hooks for TanStack Query
 * Used by configuration page for managing products
 */

import { useApiMutation } from '../useMutations'
import { queryKeys } from '../queryKeys'

// Types
interface CreateProductInput {
  carrierId: string
  name: string
  productCode?: string | null
  isActive: boolean
}

interface CreateProductResponse {
  product: Product
  message?: string
}

interface UpdateProductInput {
  productId: string
  name: string
  productCode?: string | null
  isActive: boolean
}

interface DeleteProductInput {
  productId: string
}

interface Product {
  id: string
  carrierId: string
  agencyId?: string
  name: string
  productCode?: string
  isActive: boolean
  createdAt?: string
}

/**
 * Create a new product
 */
export function useCreateProduct() {
  return useApiMutation<CreateProductResponse, CreateProductInput>('/api/products/', {
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
  return useApiMutation<Product, UpdateProductInput>(
    (variables) => `/api/products/${variables.productId}/`,
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
  return useApiMutation<void, DeleteProductInput>(
    (variables) => `/api/products/${variables.productId}/`,
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
  positionId: string
  productId: string
  commissionPercentage: number
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
  return useApiMutation<void, SaveCommissionsInput>('/api/positions/product-commissions/', {
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
  return useApiMutation<SyncCommissionsResponse, SyncCommissionsInput>(
    (variables) => `/api/positions/product-commissions/sync/?carrier_id=${variables.carrierId}`,
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
