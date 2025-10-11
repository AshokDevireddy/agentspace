// API ROUTE: /api/products/all
// This endpoint fetches all products from the products table for caching
// Used to load all products once when the products tab is accessed
// Now filters by user's agency for multi-tenant support

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

    // Fetch all products for the user's agency (active and inactive for complete cache)
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
      .eq('agency_id', agencyId)
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
    console.error('API Error in products/all:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching all products'
    }, { status: 500 })
  }
} 