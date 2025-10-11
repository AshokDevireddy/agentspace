// API ROUTE: /api/agents/downlines
// This endpoint fetches the number of downlines for a specific agent

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json({ 
        error: 'Missing agent ID',
        detail: 'Agent ID is required'
      }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Count users where upline_id matches the agent ID
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('upline_id', agentId)

    if (error) {
      console.error('Downlines count error:', error)
      return NextResponse.json({ 
        error: 'Failed to count downlines',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    return NextResponse.json({ 
      agentId,
      downlineCount: count || 0
    })

  } catch (error) {
    console.error('API Error in downlines:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while counting downlines'
    }, { status: 500 })
  }
} 