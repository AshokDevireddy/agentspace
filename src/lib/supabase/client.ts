import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'

// Singleton instance for database queries and realtime
// Note: Auth is handled via Django session cookies, not Supabase auth
let browserClient: ReturnType<typeof createSupabaseClient<Database>> | null = null

export const createClient = () => {
  if (browserClient) return browserClient

  browserClient = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
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