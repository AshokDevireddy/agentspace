import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// THIS ENDPOINT SHOULD BE USING SUPABASE/SSR BC AUTH HELPER IS DEPRECATED
// https://supabase.com/docs/guides/auth/server-side/nextjs?queryGroups=router&router=hybrid
// https://supabase.com/docs/guides/auth/auth-helpers/nextjs

export async function GET(request: Request) {
  try {
    // Get user_id from URL search params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id parameter is required' },
        { status: 400 }
      )
    }

    // console.log('Fetching profile for user ID:', userId)

    // ⚠️  SECURITY WARNING: Using admin client for TESTING ONLY
    // This bypasses ALL RLS policies - replace with proper server client later
    const supabase = createAdminClient()

    // Fetch user data from the users table using auth_user_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', userId)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    // Fetch position name using position_id from userData
    let positionName = "Unknown Position"
    if (userData.position_id) {
      const { data: positionData, error: positionError } = await supabase
        .from('positions')
        .select('name')
        .eq('id', userData.position_id)
        .single()

      if (!positionError && positionData) {
        positionName = positionData.name
      }
    }

    // Fetch position history with position details
    // console.log('Fetching position history for user ID:', userId)

    const { data: positionData, error: positionError } = await supabase
      .from('position_history')
      .select(`
        *,
        positions (
          name
        )
      `)
      .eq('agent_id', userData.id)
      .order('effective_date', { ascending: true })

    // console.log('Position history query result:', { positionData, positionError })

    if (positionError) {
      console.error('Error fetching position history:', positionError)
      // Continue without position history rather than failing completely
    }

    // Process position history data
    let processedPositionHistory = []

    // console.log('Processing position history. Data exists:', !!positionData, 'Length:', positionData?.length || 0)

    if (positionData && positionData.length > 0) {
      // console.log('Position data found, processing...')
      processedPositionHistory = positionData.map((position, index) => {
        // console.log(`Processing position ${index}:`, position)
        return {
          id: position.id,
          date: index === 0
            ? new Date(userData.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : new Date(position.effective_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }),
          title: position.positions?.name || 'Unknown Position',
          effectiveDate: position.effective_date,
          endDate: position.end_date,
          reason: position.reason
        }
      })
      // console.log('Processed position history:', processedPositionHistory)
    } else {
      console.log('No position history found, using fallback')
      // Fallback if no position history exists
      processedPositionHistory = [
        {
          id: 'fallback',
          date: new Date(userData.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          title: positionName,
          effectiveDate: userData.created_at,
          endDate: null,
          reason: null
        }
      ]
    }

    // Return sanitized user profile data
    const profileData = {
      id: userData.id,
      firstName: userData.first_name,
      lastName: userData.last_name,
      fullName: `${userData.first_name} ${userData.last_name}`,
      position: positionName,
      createdAt: userData.created_at,
      totalProduction: Number(userData.total_prod) || 0,
      totalPoliciesSold: Number(userData.total_policies_sold) || 0,
      positionHistory: processedPositionHistory,
      // Include agency_id so clients can scope queries by agency
      agency_id: userData.agency_id || null,
      // Include status, role, and is_admin for onboarding checks
      status: userData.status,
      role: userData.role,
      is_admin: userData.is_admin,
    }

    return NextResponse.json({
      success: true,
      data: profileData
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}