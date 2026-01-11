import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

interface UseSupabaseRpcOptions<T> extends Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'> {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number
}

const DEFAULT_TIMEOUT_MS = 30000

export function useSupabaseRpc<T>(
  queryKey: readonly unknown[],
  rpcName: string,
  params: Record<string, unknown>,
  options: UseSupabaseRpcOptions<T> = {}
) {
  const { timeout = DEFAULT_TIMEOUT_MS, ...queryOptions } = options
  const supabase = createClient()

  return useQuery<T, Error>({
    queryKey,
    queryFn: async ({ signal }) => {
      if (signal?.aborted) {
        throw new Error('Request aborted')
      }

      let cleanupAbortListener: (() => void) | undefined

      const timeoutPromise = new Promise<never>((_, reject) => {
        const id = setTimeout(() => reject(new Error(`RPC ${rpcName} timed out`)), timeout)
        const onAbort = () => {
          clearTimeout(id)
          reject(new Error('Request aborted'))
        }
        if (signal) {
          signal.addEventListener('abort', onAbort)
          cleanupAbortListener = () => signal.removeEventListener('abort', onAbort)
        }
      })

      const rpcPromise = supabase.rpc(rpcName, params).then(result => {
        if (result.error) throw result.error
        return result.data as T
      })

      try {
        return await Promise.race([rpcPromise, timeoutPromise])
      } finally {
        cleanupAbortListener?.()
      }
    },
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    ...queryOptions,
  })
}
