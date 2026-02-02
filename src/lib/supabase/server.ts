// lib/supabase/server.ts
// Note: Auth is handled via Django session cookies, not Supabase auth
// This module provides Supabase clients for database queries only
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Creates an admin Supabase client with service role key.
 * Use this for server-side database queries that need elevated permissions.
 * Auth is handled separately via Django session cookies.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
