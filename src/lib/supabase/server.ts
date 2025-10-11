// lib/supabase/server.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from './database.types'
import { createClient } from '@supabase/supabase-js'

export async function createServerClient() {
  // Next.js 15+ requires awaiting cookies()
  const cookieStore = await cookies()
  return createRouteHandlerClient<Database>({
    cookies: () => cookieStore,
  })
}

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
