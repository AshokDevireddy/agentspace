import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types.ts'

// Singleton instance to ensure consistent auth state across components
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export const createClient = () => {
  if (browserClient) return browserClient

  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'x-client-info': 'supabase-js-web',
        },
      },
    }
  )

  return browserClient
}