// API ROUTE: /api/positions/product-commissions/[id]
// This endpoint manages individual commission mappings
// DELETE: Deletes a commission mapping

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient()
    const { id: commissionId } = await params

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
        detail: 'User must be associated with an agency to delete commissions'
      }, { status: 403 })
    }

    // Verify the commission belongs to a position in the user's agency
    const { data: commission, error: fetchError } = await supabase
      .from('position_product_commissions')
      .select(`
        id,
        positions!inner(agency_id)
      `)
      .eq('id', commissionId)
      .single()

    if (fetchError || !commission) {
      return NextResponse.json({
        error: 'Commission not found',
        detail: 'Commission does not exist'
      }, { status: 404 })
    }

    // @ts-ignore - TypeScript doesn't understand the nested structure
    if (commission.positions.agency_id !== agencyId) {
      return NextResponse.json({
        error: 'Unauthorized',
        detail: 'This commission does not belong to your agency'
      }, { status: 403 })
    }

    // Delete the commission mapping
    const { error } = await supabase
      .from('position_product_commissions')
      .delete()
      .eq('id', commissionId)

    if (error) {
      console.error('Commission deletion error:', error)
      return NextResponse.json({
        error: 'Failed to delete commission',
        detail: 'Database delete encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('API Error in commission deletion:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while deleting commission'
    }, { status: 500 })
  }
}
