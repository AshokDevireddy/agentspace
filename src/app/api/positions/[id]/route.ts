// API ROUTE: /api/positions/[id]
// This endpoint handles updating and deleting individual positions
// PUT: Updates position data
// DELETE: Removes position from database

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient()
    
    // Parse request body
    const body = await request.json()
    const { name, level, is_active, base_commission_rate } = body

    // Validate required fields
    if (!name || level === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        detail: 'Name and level are required'
      }, { status: 400 })
    }

    // Validate level is a positive integer
    if (!Number.isInteger(level) || level < 0) {
      return NextResponse.json({ 
        error: 'Invalid level',
        detail: 'Level must be a positive integer'
      }, { status: 400 })
    }

    // Validate base commission rate if provided
    if (base_commission_rate !== undefined && base_commission_rate !== null && (isNaN(base_commission_rate) || base_commission_rate < 0 || base_commission_rate > 200)) {
      return NextResponse.json({ 
        error: 'Invalid base commission rate',
        detail: 'Base commission rate must be between 0 and 200'
      }, { status: 400 })
    }

    // Update position
    const { data: position, error: updateError } = await supabase
      .from('positions')
      .update({
        name: name.trim(),
        level: level,
        is_active: is_active !== undefined ? is_active : true,
        base_commission_rate: base_commission_rate || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Position update error:', updateError)
      
      // Check for unique constraint violation
      if (updateError.code === '23505') {
        return NextResponse.json({ 
          error: 'Position already exists',
          detail: 'A position with this name already exists'
        }, { status: 409 })
      }
      
      return NextResponse.json({ 
        error: 'Failed to update position',
        detail: 'Database update encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      position: position
    })

  } catch (error) {
    console.error('API Error in positions PUT:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while updating position'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient()

    // Check if position exists
    const { data: existingPosition, error: fetchError } = await supabase
      .from('positions')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchError || !existingPosition) {
      return NextResponse.json({ 
        error: 'Position not found',
        detail: 'The position you are trying to delete does not exist'
      }, { status: 404 })
    }

    // Delete position
    const { error: deleteError } = await supabase
      .from('positions')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Position delete error:', deleteError)
      return NextResponse.json({ 
        error: 'Failed to delete position',
        detail: 'Database delete encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Position deleted successfully'
    })

  } catch (error) {
    console.error('API Error in positions DELETE:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while deleting position'
    }, { status: 500 })
  }
} 