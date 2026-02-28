/**
 * Generic mutation utilities for TanStack Query
 * Provides type-safe wrappers with automatic cache invalidation
 *
 * Uses apiClient for direct backend calls with JWT auth and case conversion.
 */

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query'
import { QueryKeyType } from './queryKeys'
import { apiClient } from '@/lib/api-client'

type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface ApiMutationOptions<TData, TVariables, TContext = unknown> {
  /** HTTP method */
  method?: MutationMethod
  /** Static query keys to invalidate on success */
  invalidateKeys?: QueryKeyType[]
  /** Dynamic query keys based on mutation variables - use for invalidating detail queries */
  getInvalidateKeys?: (variables: TVariables) => QueryKeyType[]
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Additional mutation options */
  options?: Omit<UseMutationOptions<TData, Error, TVariables, TContext>, 'mutationFn'>
}

/**
 * Generic API mutation hook
 * @param endpointOrFn - Backend API endpoint or function that returns endpoint based on variables
 * @param config - Configuration options
 */
export function useApiMutation<TData = unknown, TVariables = unknown, TContext = unknown>(
  endpointOrFn: string | ((variables: TVariables) => string),
  config: ApiMutationOptions<TData, TVariables, TContext> = {}
) {
  const queryClient = useQueryClient()
  const { method = 'POST', invalidateKeys = [], getInvalidateKeys, timeout, options = {} } = config

  return useMutation<TData, Error, TVariables, TContext>({
    mutationFn: async (variables) => {
      const endpoint = typeof endpointOrFn === 'function' ? endpointOrFn(variables) : endpointOrFn
      const opts = { timeout }

      switch (method) {
        case 'DELETE':
          return apiClient.delete<TData>(endpoint, opts)
        case 'PUT':
          return apiClient.put<TData>(endpoint, variables, opts)
        case 'PATCH':
          return apiClient.patch<TData>(endpoint, variables, opts)
        case 'POST':
        default:
          return apiClient.post<TData>(endpoint, variables, opts)
      }
    },
    onSuccess: (data, variables, context, mutation) => {
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] })
      })

      if (getInvalidateKeys) {
        const dynamicKeys = getInvalidateKeys(variables)
        dynamicKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [...key] })
        })
      }

      if (options.onSuccess) {
        options.onSuccess(data, variables, context, mutation)
      }
    },
    onError: options.onError,
    onMutate: options.onMutate,
    onSettled: options.onSettled,
  })
}

/**
 * Mutation hook for form data (file uploads, etc.)
 */
export function useFormDataMutation<TData = unknown, TVariables extends FormData = FormData, TContext = unknown>(
  endpoint: string,
  config: Omit<ApiMutationOptions<TData, TVariables, TContext>, 'method'> & { method?: 'POST' | 'PUT' } = {}
) {
  const queryClient = useQueryClient()
  const { method = 'POST', invalidateKeys = [], timeout, options = {} } = config

  return useMutation<TData, Error, TVariables, TContext>({
    mutationFn: async (formData) => {
      return apiClient.upload<TData>(endpoint, formData, { method, timeout })
    },
    onSuccess: (data, variables, context, mutation) => {
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] })
      })
      if (options.onSuccess) {
        options.onSuccess(data, variables, context, mutation)
      }
    },
    onError: options.onError,
    onMutate: options.onMutate,
    onSettled: options.onSettled,
  })
}

/**
 * Optimistic update helper
 * Use this for mutations where you want immediate UI feedback
 */
export function useOptimisticMutation<TData, TVariables, TContext = { previousData: TData | undefined }>(
  endpointOrFn: string | ((variables: TVariables) => string),
  config: ApiMutationOptions<TData, TVariables, TContext> & {
    /** Query key for the data being optimistically updated */
    queryKey: QueryKeyType
    /** Function to compute optimistic data */
    getOptimisticData: (variables: TVariables, oldData: TData | undefined) => TData
  }
) {
  const queryClient = useQueryClient()
  const { method = 'POST', invalidateKeys = [], queryKey, getOptimisticData, timeout, options = {} } = config

  return useMutation<TData, Error, TVariables, TContext>({
    mutationFn: async (variables) => {
      const endpoint = typeof endpointOrFn === 'function' ? endpointOrFn(variables) : endpointOrFn
      const opts = { timeout }

      switch (method) {
        case 'DELETE':
          return apiClient.delete<TData>(endpoint, opts)
        case 'PUT':
          return apiClient.put<TData>(endpoint, variables, opts)
        case 'PATCH':
          return apiClient.patch<TData>(endpoint, variables, opts)
        case 'POST':
        default:
          return apiClient.post<TData>(endpoint, variables, opts)
      }
    },
    onMutate: async (variables): Promise<TContext> => {
      await queryClient.cancelQueries({ queryKey: [...queryKey] })
      const previousData = queryClient.getQueryData<TData>([...queryKey])
      queryClient.setQueryData<TData>([...queryKey], (old) =>
        getOptimisticData(variables, old)
      )
      return { previousData } as TContext
    },
    onError: (err, variables, context) => {
      if (context && typeof context === 'object' && 'previousData' in context) {
        queryClient.setQueryData([...queryKey], (context as { previousData: TData }).previousData)
      }
      queryClient.invalidateQueries({ queryKey: [...queryKey] })

      if (options.onError) {
        options.onError(err, variables, context, undefined as any)
      }
    },
    onSuccess: (data, variables, context, mutation) => {
      queryClient.setQueryData([...queryKey], data)

      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] })
      })

      if (options.onSuccess) {
        options.onSuccess(data, variables, context, mutation)
      }
    },
    onSettled: options.onSettled,
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

