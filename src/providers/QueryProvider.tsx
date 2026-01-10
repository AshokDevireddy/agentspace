'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { categorizeError } from '@/lib/error-utils'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
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
