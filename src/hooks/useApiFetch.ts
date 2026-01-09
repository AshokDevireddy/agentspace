import { useQuery, UseQueryOptions } from '@tanstack/react-query'

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
        // Try to extract error message from response body
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || errorData.message || `API error: ${response.status}`
        throw new Error(errorMessage)
      }

      return response.json()
    },
    ...options,
  })
}
