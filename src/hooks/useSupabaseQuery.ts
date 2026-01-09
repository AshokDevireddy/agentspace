import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface UseSupabaseRpcOptions<T> extends Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'> {
  timeout?: number
}

export function useSupabaseRpc<T>(
  queryKey: unknown[],
  rpcName: string,
  params: Record<string, unknown>,
  options: UseSupabaseRpcOptions<T> = {}
) {
  const { timeout = 10000, ...queryOptions } = options
  const supabase = createClient()

  return useQuery<T, Error>({
    queryKey,
    queryFn: async ({ signal }) => {
      if (signal?.aborted) {
        throw new Error('Request aborted')
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        const id = setTimeout(() => reject(new Error(`RPC ${rpcName} timed out`)), timeout)
        const onAbort = () => {
          clearTimeout(id)
          reject(new Error('Request aborted'))
        }
        signal?.addEventListener('abort', onAbort)
      })

      const rpcPromise = supabase.rpc(rpcName, params).then(result => {
        if (result.error) throw result.error
        return result.data as T
      })

      return Promise.race([rpcPromise, timeoutPromise])
    },
    ...queryOptions,
  })
}
