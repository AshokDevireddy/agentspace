// API ROUTE: /api/commission-structures/[id]
// This endpoint handles individual commission structure operations (PUT)
// Used for updating commission structures in the commission_structures table

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { id } = await context.params;
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
    const commissionStructureId = id

    // Validate required fields
    if (!carrier_id || !product_id || !position_id || !commission_type || percentage === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        detail: 'carrier_id, product_id, position_id, commission_type, and percentage are required'
      }, { status: 400 })
    }

    // Update the commission structure
    const { data: commissionStructure, error } = await supabase
      .from('commission_structures')
      .update({
        carrier_id,
        product_id,
        position_id,
        commission_type,
        percentage,
        level,
        effective_date: effective_date || new Date().toISOString().split('T')[0],
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', commissionStructureId)
      .select()
      .single()

    if (error) {
      console.error('Commission structure update error:', error)
      return NextResponse.json({ 
        error: 'Failed to update commission structure',
        detail: 'Database update encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({ commissionStructure }, { status: 200 })

  } catch (error) {
    console.error('API Error in commission structure update:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while updating commission structure'
    }, { status: 500 })
  }
}