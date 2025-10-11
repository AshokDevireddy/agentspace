// API ROUTE: /api/users
// This endpoint fetches user information by ID, primarily for getting agent names

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ 
        error: 'Missing user ID',
        detail: 'User ID is required'
      }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get user information
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, agent_number')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('User fetch error:', userError)
      return NextResponse.json({ 
        error: 'Failed to fetch user',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ 
        error: 'User not found',
        detail: 'No user found with the provided ID'
      }, { status: 404 })
    }

    return NextResponse.json({
      id: user.id,
      name: `${user.last_name}, ${user.first_name}`,
      agentNumber: user.agent_number
    })

  } catch (error) {
    console.error('API Error in users:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching user'
    }, { status: 500 })
  }
} 