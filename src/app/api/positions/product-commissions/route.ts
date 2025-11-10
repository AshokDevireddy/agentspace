// API ROUTE: /api/positions/product-commissions
// This endpoint manages position-product commission mappings
// GET: Fetches all commission mappings for the user's agency
// POST: Creates or updates commission mappings (batch operation)

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
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

    // Get the user's agency_id and id from the users table
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, agency_id')
      .eq('auth_user_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({
        error: 'User not found',
        detail: 'Failed to fetch user information'
      }, { status: 404 })
    }

    const { id: userId } = userData

    // Get carrier_id from URL search params (optional filter)
    const { searchParams } = new URL(request.url)
    const carrierId = searchParams.get('carrier_id')

    // Use RPC function to get commission mappings
    const { data: commissions, error: fetchError } = await supabase
      .rpc('get_position_product_commissions', {
        p_user_id: userId,
        p_carrier_id: carrierId || null
      })

    if (fetchError) {
      console.error('Commissions fetch error:', fetchError)
      return NextResponse.json({
        error: 'Failed to fetch commissions',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json(commissions || [])

  } catch (error) {
    console.error('API Error in commissions:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching commissions'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const { commissions } = body

    // Validate required fields
    if (!Array.isArray(commissions) || commissions.length === 0) {
      return NextResponse.json({
        error: 'Missing required fields',
        detail: 'commissions array is required'
      }, { status: 400 })
    }

    // Validate each commission entry
    for (const commission of commissions) {
      const { position_id, product_id, commission_percentage } = commission

      if (!position_id || !product_id || commission_percentage === undefined || commission_percentage === null) {
        return NextResponse.json({
          error: 'Invalid commission data',
          detail: 'Each commission must have position_id, product_id, and commission_percentage'
        }, { status: 400 })
      }

      // Validate commission_percentage range
      if (commission_percentage < 0 || commission_percentage > 999.99) {
        return NextResponse.json({
          error: 'Invalid commission percentage',
          detail: 'commission_percentage must be between 0 and 999.99'
        }, { status: 400 })
      }
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
        detail: 'User must be associated with an agency to create commissions'
      }, { status: 403 })
    }

    // Verify that all positions and products belong to the user's agency
    const positionIds = [...new Set(commissions.map((c: any) => c.position_id))]
    const productIds = [...new Set(commissions.map((c: any) => c.product_id))]

    const { data: positions, error: posError } = await supabase
      .from('positions')
      .select('id')
      .in('id', positionIds)
      .eq('agency_id', agencyId)

    if (posError || !positions || positions.length !== positionIds.length) {
      return NextResponse.json({
        error: 'Invalid position',
        detail: 'One or more positions do not belong to your agency'
      }, { status: 403 })
    }

    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id')
      .in('id', productIds)
      .eq('agency_id', agencyId)

    if (prodError || !products || products.length !== productIds.length) {
      return NextResponse.json({
        error: 'Invalid product',
        detail: 'One or more products do not belong to your agency'
      }, { status: 403 })
    }

    // Use upsert to create or update commission mappings
    const commissionsToInsert = commissions.map((c: any) => ({
      position_id: c.position_id,
      product_id: c.product_id,
      commission_percentage: c.commission_percentage
    }))

    const { data: result, error } = await supabase
      .from('position_product_commissions')
      .upsert(commissionsToInsert, {
        onConflict: 'position_id,product_id',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      console.error('Commission creation error:', error)
      return NextResponse.json({
        error: 'Failed to create/update commissions',
        detail: 'Database insert encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({ commissions: result }, { status: 201 })

  } catch (error) {
    console.error('API Error in commission creation:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while creating commissions'
    }, { status: 500 })
  }
}
