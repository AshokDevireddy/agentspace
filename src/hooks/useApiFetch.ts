import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

interface UseApiFetchOptions<T> extends Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'> {}

export function useApiFetch<T>(
  queryKey: readonly unknown[],
  endpoint: string,
  options: UseApiFetchOptions<T> = {}
) {
  return useQuery<T, Error>({
    queryKey,
    queryFn: async ({ signal }) => {
      return apiClient.get<T>(endpoint, { signal })
    },
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    ...options,
  })
}
