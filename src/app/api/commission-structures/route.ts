// API ROUTE: /api/commission-structures
// This endpoint fetches commission structures from the commission_structures table
// Used to populate commission percentages for specific carrier/product combinations

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Create admin Supabase client
    const supabase = createAdminClient()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const carrierId = searchParams.get('carrier_id')
    const productId = searchParams.get('product_id')
    const commissionType = searchParams.get('commission_type')

    if (!carrierId || !productId || !commissionType) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        detail: 'carrier_id, product_id, and commission_type are required'
      }, { status: 400 })
    }

    // Fetch commission structures for the specified parameters
    const { data: commissionStructures, error: fetchError } = await supabase
      .from('commission_structures')
      .select(`
        id,
        carrier_id,
        product_id,
        position_id,
        commission_type,
        percentage,
        level,
        effective_date,
        end_date,
        is_active,
        notes,
        created_by,
        created_at,
        updated_at
      `)
      .eq('carrier_id', carrierId)
      .eq('product_id', productId)
      .eq('commission_type', commissionType)
      .eq('is_active', true)
      .is('end_date', null) // Only get currently active structures
      .order('position_id', { ascending: true })

    if (fetchError) {
      console.error('Commission structures fetch error:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to fetch commission structures',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json(commissionStructures || [])

  } catch (error) {
    console.error('API Error in commission-structures:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching commission structures'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    
    const { 
      carrier_id, 
      product_id, 
      position_id, 
      commission_type, 
      percentage, 
      level = 0,
      effective_date,
      is_active = true
    } = body

    // Validate required fields
    if (!carrier_id || !product_id || !position_id || !commission_type || percentage === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        detail: 'carrier_id, product_id, position_id, commission_type, and percentage are required'
      }, { status: 400 })
    }

    // Insert the new commission structure
    const { data: commissionStructure, error } = await supabase
      .from('commission_structures')
      .insert({
        carrier_id,
        product_id,
        position_id,
        commission_type,
        percentage,
        level,
        effective_date: effective_date || new Date().toISOString().split('T')[0],
        is_active,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Commission structure creation error:', error)
      return NextResponse.json({ 
        error: 'Failed to create commission structure',
        detail: 'Database insert encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({ commissionStructure }, { status: 201 })

  } catch (error) {
    console.error('API Error in commission structure creation:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while creating commission structure'
    }, { status: 500 })
  }
} 