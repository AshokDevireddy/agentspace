import { useQuery, UseQueryOptions } from '@tanstack/react-query'

interface UseApiFetchOptions<T> extends Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'> {}

export function useApiFetch<T>(
  queryKey: unknown[],
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
        throw new Error(`API error: ${response.status}`)
      }

      return response.json()
    },
    ...options,
  })
}
