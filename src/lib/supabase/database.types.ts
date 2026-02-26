// Supabase database types
//
// POST-MIGRATION NOTE: This file exports `Database = any` intentionally.
// The application has migrated from direct Supabase queries to a Django backend.
// All data fetching now goes through Django REST API endpoints with their own
// serialization and type safety. The Supabase client is only used for authentication
// (login, register, password reset), which doesn't require typed table definitions.
//
// If you need to regenerate full types for any remaining direct Supabase usage:
// npx supabase gen types typescript --project-id <project-id> --schema public > src/lib/supabase/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Database type is intentionally `any` post-migration.
// All data access is through Django API — Supabase client is auth-only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any
