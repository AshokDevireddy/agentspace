// API ROUTE: /api/carriers/with-products
// This endpoint fetches carriers that have at least one product for the user's agency
// Used specifically for the commissions tab dropdown to only show carriers with products
// Authentication is required

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Create admin Supabase client
    const supabase = createAdminClient()

    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        detail: 'No valid token provided'
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the token and get user info
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        detail: 'Invalid token'
      }, { status: 401 })
    }

    // Get the user's agency_id from the users table
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('agency_id')
      .eq('auth_user_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({ 
        error: 'User not found',
        detail: 'Failed to fetch user information'
      }, { status: 404 })
    }

    const agencyId = userData.agency_id

    if (!agencyId) {
      return NextResponse.json({ 
        error: 'User not associated with an agency',
        detail: 'User must be associated with an agency to view carriers'
      }, { status: 403 })
    }

    // Step 1: Get all products for the user's agency
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('carrier_id')
      .eq('agency_id', agencyId)
      .eq('is_active', true)

    if (productsError) {
      console.error('Products fetch error:', productsError)
      return NextResponse.json({ 
        error: 'Failed to fetch products',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    if (!products || products.length === 0) {
      // Return empty array if no products found for the agency
      return NextResponse.json([])
    }

    // Step 2: Extract unique carrier IDs
    const uniqueCarrierIds = [...new Set(products.map(product => product.carrier_id))]

    // Step 3: Get carrier details for the unique carrier IDs
    const { data: carriers, error: carriersError } = await supabase
      .from('carriers')
      .select(`
        id,
        name,
        display_name,
        is_active,
        created_at
      `)
      .in('id', uniqueCarrierIds)
      .eq('is_active', true)
      .order('display_name', { ascending: true })

    if (carriersError) {
      console.error('Carriers fetch error:', carriersError)
      return NextResponse.json({ 
        error: 'Failed to fetch carriers',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json(carriers || [])

  } catch (error) {
    console.error('API Error in carriers/with-products:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching carriers with products'
    }, { status: 500 })
  }
}

