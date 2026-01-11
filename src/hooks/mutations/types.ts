/**
 * Standardized types for mutation hooks
 * Ensures consistent callback signatures across all mutations
 */

/**
 * Standard mutation options interface
 * All mutations should follow this pattern for callbacks
 */
export interface MutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void
  onError?: (error: Error) => void
}

/**
 * Extended mutation options with additional invalidation controls
 */
export interface ExtendedMutationOptions<TData, TVariables> extends MutationOptions<TData, TVariables> {
  /**
   * Skip automatic cache invalidation
   * Useful when you want to handle invalidation manually
   */
  skipInvalidation?: boolean
}

/**
 * Mutation result with standard properties
 */
export interface MutationResult {
  success: boolean
  error?: string
}

/**
 * Standard response types for common mutation operations
 */
export interface CreateResponse<T = string> {
  id: T
  created: boolean
}

export interface UpdateResponse {
  success: boolean
  updated: boolean
}

export interface DeleteResponse {
  success: boolean
  deleted: boolean
}

/**
 * Pagination types for list mutations
 */
export interface BulkActionInput {
  ids: string[]
}

export interface BulkActionResponse {
  success: boolean
  processed: number
  failed?: number
  errors?: string[]
}
