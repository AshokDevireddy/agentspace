// API ROUTE: /api/products/[id]
// This endpoint handles individual product operations (PUT, DELETE)
// Used for updating and deleting products in the products table
// Now includes agency-based security checks

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient()
    const body = await request.json()

    const { name, product_code, is_active } = body
    const productId = id

    // Validate required fields
    if (!name) {
      return NextResponse.json({
        error: 'Missing required fields',
        detail: 'name is required'
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

    const userAgencyId = userData.agency_id

    if (!userAgencyId) {
      return NextResponse.json({
        error: 'User not associated with an agency',
        detail: 'User must be associated with an agency to modify products'
      }, { status: 403 })
    }

    // Verify the product belongs to the user's agency
    const { data: existingProduct, error: productCheckError } = await supabase
      .from('products')
      .select('agency_id')
      .eq('id', productId)
      .single()

    if (productCheckError || !existingProduct) {
      return NextResponse.json({
        error: 'Product not found',
        detail: 'The specified product does not exist'
      }, { status: 404 })
    }

    if (existingProduct.agency_id !== userAgencyId) {
      return NextResponse.json({
        error: 'Access denied',
        detail: 'You can only modify products from your own agency'
      }, { status: 403 })
    }

    // Update the product
    const { data: product, error } = await supabase
      .from('products')
      .update({
        name,
        product_code: product_code || null,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select()
      .single()

    if (error) {
      console.error('Product update error:', error)
      return NextResponse.json({
        error: 'Failed to update product',
        detail: 'Database update encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({ product }, { status: 200 })

  } catch (error) {
    console.error('API Error in product update:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while updating product'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient()
    const productId = id

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

    const userAgencyId = userData.agency_id

    if (!userAgencyId) {
      return NextResponse.json({
        error: 'User not associated with an agency',
        detail: 'User must be associated with an agency to delete products'
      }, { status: 403 })
    }

    // Verify the product belongs to the user's agency
    const { data: existingProduct, error: productCheckError } = await supabase
      .from('products')
      .select('agency_id')
      .eq('id', productId)
      .single()

    if (productCheckError || !existingProduct) {
      return NextResponse.json({
        error: 'Product not found',
        detail: 'The specified product does not exist'
      }, { status: 404 })
    }

    if (existingProduct.agency_id !== userAgencyId) {
      return NextResponse.json({
        error: 'Access denied',
        detail: 'You can only delete products from your own agency'
      }, { status: 403 })
    }

    // Delete the product
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)

    if (error) {
      console.error('Product deletion error:', error)
      return NextResponse.json({
        error: 'Failed to delete product',
        detail: 'Database delete encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({ message: 'Product deleted successfully' }, { status: 200 })

  } catch (error) {
    console.error('API Error in product deletion:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while deleting product'
    }, { status: 500 })
  }
}