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
  /** Static query keys to invalidate on success */
  invalidateKeys?: QueryKeyType[]
  /** Dynamic query keys based on mutation variables - use for invalidating detail queries */
  getInvalidateKeys?: (variables: TVariables) => QueryKeyType[]
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
  const { method = 'POST', invalidateKeys = [], getInvalidateKeys, options = {} } = config

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const url = typeof urlOrFn === 'function' ? urlOrFn(variables) : urlOrFn

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: method !== 'DELETE' ? JSON.stringify(variables) : undefined,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`)
      }

      return response.json()
    },
    onSuccess: (data, variables, context) => {
      // Invalidate static query keys
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] })
      })

      // Invalidate dynamic query keys based on variables
      if (getInvalidateKeys) {
        const dynamicKeys = getInvalidateKeys(variables)
        dynamicKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [...key] })
        })
      }

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
        credentials: 'include',
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
        credentials: 'include',
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

/**
 * Authenticated API mutation hook
 * Use this for API routes that require Bearer token authentication
 * @param urlOrFn - API endpoint URL or function that returns URL based on variables
 * @param config - Configuration options
 */
export function useAuthenticatedMutation<TData = unknown, TVariables = unknown>(
  urlOrFn: string | ((variables: TVariables) => string),
  config: ApiMutationOptions<TData, TVariables> = {}
) {
  const queryClient = useQueryClient()
  const { method = 'POST', invalidateKeys = [], getInvalidateKeys, options = {} } = config

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      // Dynamic import to avoid circular dependencies
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        throw new Error('Authentication required. Please log in.')
      }

      const url = typeof urlOrFn === 'function' ? urlOrFn(variables) : urlOrFn

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: method !== 'DELETE' ? JSON.stringify(variables) : undefined,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`)
      }

      // Handle empty responses (204 No Content)
      const text = await response.text()
      return text ? JSON.parse(text) : null
    },
    onSuccess: (data, variables, context) => {
      // Invalidate static query keys
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] })
      })

      // Invalidate dynamic query keys based on variables
      if (getInvalidateKeys) {
        const dynamicKeys = getInvalidateKeys(variables)
        dynamicKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [...key] })
        })
      }

      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}
