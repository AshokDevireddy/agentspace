// API ROUTE: /api/products
// This endpoint fetches products from the products table filtered by carrier_id
// Used to populate products list when a carrier is selected
// Now also filters by user's agency for multi-tenant support

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
        detail: 'User must be associated with an agency to view products'
      }, { status: 403 })
    }

    // Get carrier_id from URL search params
    const { searchParams } = new URL(request.url)
    const carrierId = searchParams.get('carrier_id')

    if (!carrierId) {
      return NextResponse.json({
        error: 'Missing carrier_id parameter',
        detail: 'carrier_id is required to fetch products'
      }, { status: 400 })
    }

    // Fetch products for the specified carrier and user's agency
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select(`
        id,
        carrier_id,
        name,
        product_code,
        is_active,
        created_at
      `)
      .eq('carrier_id', carrierId)
      .eq('agency_id', agencyId)
      .eq('is_active', true) // Only fetch active products
      .order('name', { ascending: true }) // Order by product name

    if (fetchError) {
      console.error('Products fetch error:', fetchError)
      return NextResponse.json({
        error: 'Failed to fetch products',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json(products || [])

  } catch (error) {
    console.error('API Error in products:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching products'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const { carrier_id, name, product_code, is_active } = body

    // Validate required fields
    if (!carrier_id || !name) {
      return NextResponse.json({
        error: 'Missing required fields',
        detail: 'carrier_id and name are required'
      }, { status: 400 })
    }

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
        detail: 'User must be associated with an agency to create products'
      }, { status: 403 })
    }

    // Insert the new product with agency_id
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        carrier_id,
        agency_id: agencyId,
        name,
        product_code: product_code || null,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single()

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({
          error: 'A product with this name already exists for this carrier.',
          detail: error.message
        }, { status: 409 });
      }

      console.error('Product creation error:', error)
      return NextResponse.json({
        error: 'Failed to create product',
        detail: 'Database insert encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({ product }, { status: 201 })

  } catch (error) {
    console.error('API Error in product creation:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while creating product'
    }, { status: 500 })
  }
}