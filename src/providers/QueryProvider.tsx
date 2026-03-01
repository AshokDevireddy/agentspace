'use client'

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { categorizeError, getRetryDelay } from '@/lib/error-utils'
import { getAccessToken } from '@/lib/auth/token-store'
import { AUTH_PATHS } from '@/lib/auth/constants'

// Safety net: redirect on cascading auth errors after token is already cleared
function handleAuthError(error: unknown) {
  const category = categorizeError(error)
  if (category !== 'auth') return
  if (typeof window === 'undefined') return
  if (AUTH_PATHS.some(p => window.location.pathname.startsWith(p))) return

  // Token already cleared — auth is irrecoverable, redirect now
  if (!getAccessToken()) {
    window.location.href = '/login'
    return
  }

  // Token still present — attempt refresh flow
  window.dispatchEvent(new Event('auth:token-expired'))
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    queryCache: new QueryCache({
      onError: handleAuthError,
    }),
    mutationCache: new MutationCache({
      onError: handleAuthError,
    }),
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 30 * 60 * 1000, // 30 minutes - garbage collect unused cache entries
        retry: (failureCount, error) => {
          // Smart retry logic based on error category
          const category = categorizeError(error)
          // Don't retry auth errors - user needs to re-authenticate
          if (category === 'auth') return false
          // Don't retry validation errors - input is invalid
          if (category === 'validation') return false
          // Don't retry not found errors - resource doesn't exist
          if (category === 'not_found') return false
          // Retry network and server errors up to 2 times
          return failureCount < 2
        },
        // Exponential backoff with jitter for retries
        retryDelay: (attemptIndex, error) => getRetryDelay(error, attemptIndex + 1),
        refetchOnWindowFocus: process.env.NODE_ENV === 'production',
        // Refetch when user comes back online to ensure fresh data
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0, // Never auto-retry mutations - prevents duplicate submissions
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
