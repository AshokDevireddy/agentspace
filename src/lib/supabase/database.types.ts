// Supabase database types
// Note: For full type safety, regenerate using:
// npx supabase gen types typescript --project-id <project-id> --schema public > src/lib/supabase/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Using 'any' for table definitions to allow flexible queries without generated types
// This trades off type safety for functionality - queries will work but won't have type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any
