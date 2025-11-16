// API ROUTE: /api/positions/product-commissions/sync
// This endpoint creates missing position_product_commissions entries
// POST: Finds products without commission entries and creates them with 0%

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
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
        detail: 'User must be associated with an agency to sync commissions'
      }, { status: 403 })
    }

    // Get carrier_id from URL search params (optional filter)
    const { searchParams } = new URL(request.url)
    const carrierId = searchParams.get('carrier_id')

    // Get all active positions for this agency
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('is_active', true)

    if (positionsError) {
      console.error('Error fetching positions:', positionsError)
      return NextResponse.json({
        error: 'Failed to fetch positions',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    if (!positions || positions.length === 0) {
      return NextResponse.json({
        error: 'No positions found',
        detail: 'Please create positions before syncing commissions'
      }, { status: 400 })
    }

    // Get all active products for this agency (optionally filtered by carrier)
    let productsQuery = supabase
      .from('products')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('is_active', true)

    if (carrierId) {
      productsQuery = productsQuery.eq('carrier_id', carrierId)
    }

    const { data: products, error: productsError } = await productsQuery

    if (productsError) {
      console.error('Error fetching products:', productsError)
      return NextResponse.json({
        error: 'Failed to fetch products',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return NextResponse.json({
        error: 'No products found',
        detail: 'Please create products before syncing commissions'
      }, { status: 400 })
    }

    // Get existing commission entries
    const positionIds = positions.map(p => p.id)
    const productIds = products.map(p => p.id)

    const { data: existingCommissions, error: commissionsError } = await supabase
      .from('position_product_commissions')
      .select('position_id, product_id')
      .in('position_id', positionIds)
      .in('product_id', productIds)

    if (commissionsError) {
      console.error('Error fetching existing commissions:', commissionsError)
      return NextResponse.json({
        error: 'Failed to fetch existing commissions',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    // Create a Set of existing combinations for quick lookup
    const existingSet = new Set(
      existingCommissions.map(c => `${c.position_id}:${c.product_id}`)
    )

    // Find missing combinations
    const missingCommissions = []
    for (const position of positions) {
      for (const product of products) {
        const key = `${position.id}:${product.id}`
        if (!existingSet.has(key)) {
          missingCommissions.push({
            position_id: position.id,
            product_id: product.id,
            commission_percentage: 0
          })
        }
      }
    }

    // If no missing commissions, return early
    if (missingCommissions.length === 0) {
      return NextResponse.json({
        message: 'All products already have commission entries',
        created: 0
      }, { status: 200 })
    }

    // Insert missing commissions
    const { error: insertError } = await supabase
      .from('position_product_commissions')
      .insert(missingCommissions)

    if (insertError) {
      console.error('Error inserting missing commissions:', insertError)
      return NextResponse.json({
        error: 'Failed to create commission entries',
        detail: 'Database insert encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({
      message: `Successfully created ${missingCommissions.length} commission entries`,
      created: missingCommissions.length
    }, { status: 201 })

  } catch (error) {
    console.error('API Error in commission sync:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while syncing commissions'
    }, { status: 500 })
  }
}
