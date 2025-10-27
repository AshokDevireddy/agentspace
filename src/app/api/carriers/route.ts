// API ROUTE: /api/carriers
// This endpoint fetches all carriers from the carriers table
// Used to populate carrier dropdown in the products and commission configuration

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Create admin Supabase client
    const supabase = createAdminClient()

    // Fetch all active carriers from the carriers table
    const { data: carriers, error: fetchError } = await supabase
      .from('carriers')
      .select(`
        id,
        name,
        display_name,
        is_active,
        created_at
      `)
      .eq('is_active', true) // Only fetch active carriers
      .order('display_name', { ascending: true }) // Order by display name

    if (fetchError) {
      console.error('Carriers fetch error:', fetchError)
      return NextResponse.json({
        error: 'Failed to fetch carriers',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json(carriers || [])

  } catch (error) {
    console.error('API Error in carriers:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching carriers'
    }, { status: 500 })
  }
}