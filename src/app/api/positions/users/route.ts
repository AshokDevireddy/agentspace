// API ROUTE: /api/positions/users
// This endpoint fetches all users with their position and upline information

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const supabase = createAdminClient()

    // First, get total count of users
    const { count: totalCount, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Users count error:', countError)
      return NextResponse.json({ 
        error: 'Failed to count users',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    // Get paginated users with their basic information
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        position_id,
        upline_id,
        start_date
      `)
      .order('last_name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (usersError) {
      console.error('Users fetch error:', usersError)
      return NextResponse.json({ 
        error: 'Failed to fetch users',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        users: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          limit,
          hasNextPage: false,
          hasPrevPage: false
        }
      })
    }

    // Get all position IDs to fetch position names
    const positionIds = users
      .map(user => user.position_id)
      .filter(id => id !== null) as string[]

    // Fetch position names
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select('id, name')
      .in('id', positionIds)

    if (positionsError) {
      console.error('Positions fetch error:', positionsError)
      return NextResponse.json({ 
        error: 'Failed to fetch positions',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    // Create a map of position IDs to names
    const positionMap = new Map(
      positions?.map(pos => [pos.id, pos.name]) || []
    )

    // Get all upline IDs to fetch upline names
    const uplineIds = users
      .map(user => user.upline_id)
      .filter(id => id !== null) as string[]

    // Fetch upline names
    const { data: uplines, error: uplinesError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', uplineIds)

    if (uplinesError) {
      console.error('Uplines fetch error:', uplinesError)
      return NextResponse.json({ 
        error: 'Failed to fetch uplines',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    // Create a map of upline IDs to names
    const uplineMap = new Map(
      uplines?.map(upline => [upline.id, `${upline.last_name}, ${upline.first_name}`]) || []
    )
    // Add null entry for users with no upline
    uplineMap.set(null, 'None')

    // Transform users to match the expected format
    const formattedUsers = users.map(user => {
      const positionName = user.position_id ? positionMap.get(user.position_id) || 'Unknown' : 'Unknown'
      const uplineName = uplineMap.get(user.upline_id) || 'None'
      
      return {
        id: user.id,
        user: `${user.last_name}, ${user.first_name}`,
        position: positionName,
        upline: uplineName,
        start: new Date(user.start_date || '').toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      }
    })

    const totalPages = Math.ceil((totalCount || 0) / limit)

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: totalCount || 0,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    })

  } catch (error) {
    console.error('API Error in positions/users:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching users'
    }, { status: 500 })
  }
} 