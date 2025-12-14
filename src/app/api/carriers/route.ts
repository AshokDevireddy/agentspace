// API ROUTE: /api/carriers
// This endpoint fetches all carriers from the carriers table
// Used to populate carrier dropdown in the products and commission configuration
// Supports ?filter=nipr to filter carriers by NIPR unique_carriers fuzzy matching

import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { findMatchingCarriers, type ActiveCarrier } from '@/lib/nipr/fuzzy-match'

export async function GET(request: NextRequest) {
  try {
    // Check if NIPR filtering is requested
    const filterByNipr = request.nextUrl.searchParams.get('filter') === 'nipr'

    // Create admin Supabase client
    const adminClient = createAdminClient()

    // Fetch all active carriers from the carriers table
    const { data: carriers, error: fetchError } = await adminClient
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

    // If no NIPR filter requested, return all carriers
    if (!filterByNipr) {
      return NextResponse.json(carriers || [])
    }

    // Get current user's unique_carriers for filtering
    const supabase = await createServerClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      // No authenticated user - return all carriers
      return NextResponse.json(carriers || [])
    }

    // Get user's unique_carriers directly from users table
    const { data: userData } = await supabase
      .from('users')
      .select('unique_carriers')
      .eq('auth_user_id', authUser.id)
      .single()

    // unique_carriers is now text[] on users table
    const uniqueCarriers: string[] = userData?.unique_carriers || []

    // If no unique_carriers, return all carriers (backwards compatibility)
    if (uniqueCarriers.length === 0) {
      return NextResponse.json(carriers || [])
    }

    // Fuzzy match carriers at 80% threshold
    const activeCarriers: ActiveCarrier[] = (carriers || []).map(c => ({
      id: c.id,
      name: c.name,
      display_name: c.display_name
    }))

    const matchedCarriers = findMatchingCarriers(uniqueCarriers, activeCarriers, 0.8)

    // Return matched carriers in the same format as original response
    const filteredCarriers = matchedCarriers.map(m => {
      const original = carriers?.find(c => c.id === m.id)
      return original || { id: m.id, name: m.name, display_name: m.display_name, is_active: true, created_at: null }
    })

    return NextResponse.json(filteredCarriers)

  } catch (error) {
    console.error('API Error in carriers:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching carriers'
    }, { status: 500 })
  }
}