// API ROUTE: /api/positions/all
// This endpoint fetches all positions from the positions table for the configuration page
// Used to populate the positions table when navigating to the positions tab

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Create admin Supabase client
    const supabase = createAdminClient()

    // Optional: scope by agency via query param `agencyId`
    const { searchParams } = new URL(request.url)
    const agencyId = searchParams.get('agencyId')

    const query = supabase
      .from('positions')
      .select(`
        id,
        name,
        level,
        is_active,
        base_commission_rate,
        created_at,
        updated_at,
        created_by,
        agency_id
      `)
      .order('level', { ascending: true })

    const { data: positions, error: fetchError } = agencyId
      ? await query.eq('agency_id', agencyId)
      : await query

    if (fetchError) {
      console.error('Positions fetch error:', fetchError)
      return NextResponse.json({
        error: 'Failed to fetch positions',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json(positions || [])

  } catch (error) {
    console.error('API Error in positions/all:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching positions'
    }, { status: 500 })
  }
}