/**
 * Generic mutation utilities for TanStack Query
 * Provides type-safe wrappers with automatic cache invalidation
 */

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query'
import { QueryKeyType } from './queryKeys'

type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface ApiMutationOptions<TData, TVariables> {
  /** HTTP method */
  method?: MutationMethod
  /** Query keys to invalidate on success */
  invalidateKeys?: QueryKeyType[]
  /** Additional mutation options */
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>
}

/**
 * Generic API mutation hook
 * @param urlOrFn - API endpoint URL or function that returns URL based on variables
 * @param config - Configuration options
 */
export function useApiMutation<TData = unknown, TVariables = unknown>(
  urlOrFn: string | ((variables: TVariables) => string),
  config: ApiMutationOptions<TData, TVariables> = {}
) {
  const queryClient = useQueryClient()
  const { method = 'POST', invalidateKeys = [], options = {} } = config

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const url = typeof urlOrFn === 'function' ? urlOrFn(variables) : urlOrFn

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method !== 'DELETE' ? JSON.stringify(variables) : undefined,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`)
      }

      return response.json()
    },
    onSuccess: (data, variables, context) => {
      // Invalidate specified query keys
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] })
      })

      // Call user's onSuccess if provided
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

/**
 * Mutation hook for form data (file uploads, etc.)
 */
export function useFormDataMutation<TData = unknown, TVariables extends FormData = FormData>(
  url: string,
  config: Omit<ApiMutationOptions<TData, TVariables>, 'method'> & { method?: 'POST' | 'PUT' } = {}
) {
  const queryClient = useQueryClient()
  const { method = 'POST', invalidateKeys = [], options = {} } = config

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (formData) => {
      const response = await fetch(url, {
        method,
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary for FormData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`)
      }

      return response.json()
    },
    onSuccess: (data, variables, context) => {
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] })
      })
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

/**
 * Optimistic update helper
 * Use this for mutations where you want immediate UI feedback
 */
export function useOptimisticMutation<TData, TVariables, TContext = unknown>(
  urlOrFn: string | ((variables: TVariables) => string),
  config: ApiMutationOptions<TData, TVariables> & {
    /** Query key for the data being optimistically updated */
    queryKey: QueryKeyType
    /** Function to compute optimistic data */
    getOptimisticData: (variables: TVariables, oldData: TData | undefined) => TData
  }
) {
  const queryClient = useQueryClient()
  const { method = 'POST', invalidateKeys = [], queryKey, getOptimisticData, options = {} } = config

  return useMutation<TData, Error, TVariables, TContext>({
    mutationFn: async (variables) => {
      const url = typeof urlOrFn === 'function' ? urlOrFn(variables) : urlOrFn

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method !== 'DELETE' ? JSON.stringify(variables) : undefined,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`)
      }

      return response.json()
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [...queryKey] })

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TData>([...queryKey])

      // Optimistically update
      queryClient.setQueryData<TData>([...queryKey], (old) =>
        getOptimisticData(variables, old)
      )

      // Return context with the snapshot
      return { previousData } as TContext
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context && typeof context === 'object' && 'previousData' in context) {
        queryClient.setQueryData([...queryKey], (context as { previousData: TData }).previousData)
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: [...queryKey] })
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] })
      })
    },
    ...options,
  })
}

/**
 * Helper to invalidate multiple query keys at once
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient()

  return (keys: QueryKeyType[]) => {
    keys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: [...key] })
    })
  }
}
