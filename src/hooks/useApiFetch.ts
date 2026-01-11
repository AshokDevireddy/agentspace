import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { createHttpError, shouldRetry, getRetryDelay } from './useQueryRetry'

interface UseApiFetchOptions<T> extends Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'> {}

export function useApiFetch<T>(
  queryKey: readonly unknown[],
  url: string,
  options: UseApiFetchOptions<T> = {}
) {
  return useQuery<T, Error>({
    queryKey,
    queryFn: async ({ signal }) => {
      const response = await fetch(url, {
        signal,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || errorData.message || `API error: ${response.status}`
        throw createHttpError(errorMessage, response.status)
      }

      return response.json()
    },
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    ...options,
  })
}
