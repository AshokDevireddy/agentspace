/**
 * Generic mutation utilities for TanStack Query
 * Provides type-safe wrappers with automatic cache invalidation
 */

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query'
import { QueryKeyType } from './queryKeys'
import { createErrorFromResponse, NetworkError } from '@/lib/error-utils'

type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Default mutation timeout in milliseconds */
const DEFAULT_MUTATION_TIMEOUT = 30000 // 30 seconds

interface ApiMutationOptions<TData, TVariables> {
  /** HTTP method */
  method?: MutationMethod
  /** Static query keys to invalidate on success */
  invalidateKeys?: QueryKeyType[]
  /** Dynamic query keys based on mutation variables - use for invalidating detail queries */
  getInvalidateKeys?: (variables: TVariables) => QueryKeyType[]
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Additional mutation options */
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>
}

/**
 * Create a fetch request with timeout and abort handling
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_MUTATION_TIMEOUT
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new NetworkError('Request timed out. Please try again.')
    }
    // Wrap network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new NetworkError()
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Parse response body, handling empty responses
 */
async function parseResponseBody<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text) {
    return null as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    // Return text as-is if not JSON
    return text as unknown as T
  }
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
  const { method = 'POST', invalidateKeys = [], getInvalidateKeys, timeout, options = {} } = config

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const url = typeof urlOrFn === 'function' ? urlOrFn(variables) : urlOrFn

      const response = await fetchWithTimeout(
        url,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: method !== 'DELETE' ? JSON.stringify(variables) : undefined,
        },
        timeout
      )

      if (!response.ok) {
        throw await createErrorFromResponse(response)
      }

      return parseResponseBody<TData>(response)
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
  const { method = 'POST', invalidateKeys = [], timeout = 60000, options = {} } = config // 60s default for uploads

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (formData) => {
      const response = await fetchWithTimeout(
        url,
        {
          method,
          credentials: 'include',
          body: formData,
          // Don't set Content-Type header - browser will set it with boundary for FormData
        },
        timeout
      )

      if (!response.ok) {
        throw await createErrorFromResponse(response)
      }

      return parseResponseBody<TData>(response)
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
export function useOptimisticMutation<TData, TVariables, TContext = { previousData: TData | undefined }>(
  urlOrFn: string | ((variables: TVariables) => string),
  config: ApiMutationOptions<TData, TVariables> & {
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
      const url = typeof urlOrFn === 'function' ? urlOrFn(variables) : urlOrFn

      const response = await fetchWithTimeout(
        url,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: method !== 'DELETE' ? JSON.stringify(variables) : undefined,
        },
        timeout
      )

      if (!response.ok) {
        throw await createErrorFromResponse(response)
      }

      return parseResponseBody<TData>(response)
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
      // Invalidate to ensure consistency after error
      queryClient.invalidateQueries({ queryKey: [...queryKey] })
    },
    onSuccess: (data, variables, ctx) => {
      // Update cache with actual server response (instead of invalidating)
      queryClient.setQueryData([...queryKey], data)

      // Invalidate related queries
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] })
      })

      options.onSuccess?.(data, variables, ctx)
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
  const { method = 'POST', invalidateKeys = [], getInvalidateKeys, timeout, options = {} } = config

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      // Dynamic import to avoid circular dependencies
      const { createClient } = await import('@/lib/supabase/client')
      const { AuthError } = await import('@/lib/error-utils')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        throw new AuthError('Authentication required. Please log in.')
      }

      const url = typeof urlOrFn === 'function' ? urlOrFn(variables) : urlOrFn

      const response = await fetchWithTimeout(
        url,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          credentials: 'include',
          body: method !== 'DELETE' ? JSON.stringify(variables) : undefined,
        },
        timeout
      )

      if (!response.ok) {
        throw await createErrorFromResponse(response)
      }

      return parseResponseBody<TData>(response)
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
