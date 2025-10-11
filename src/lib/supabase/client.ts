import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from './database.types.ts'

export const createClient = () => {
  return createClientComponentClient<Database>()
}