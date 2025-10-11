// API ROUTE: /api/agents/[id]
// This endpoint fetches agent information by ID

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id

    if (!agentId) {
      return NextResponse.json({ 
        error: 'Missing agent ID',
        detail: 'Agent ID is required'
      }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get agent information
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        position_id,
        upline_id,
        created_at,
        is_active,
        total_prod,
        total_policies_sold
      `)
      .eq('id', agentId)
      .single()

    if (agentError) {
      console.error('Agent fetch error:', agentError)
      return NextResponse.json({ 
        error: 'Failed to fetch agent',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    if (!agent) {
      return NextResponse.json({ 
        error: 'Agent not found',
        detail: 'No agent found with the provided ID'
      }, { status: 404 })
    }

    // Get position name
    let positionName = 'Unknown'
    if (agent.position_id) {
      const { data: position } = await supabase
        .from('positions')
        .select('name')
        .eq('id', agent.position_id)
        .single()
      positionName = position?.name || 'Unknown'
    }

    // Get upline name
    let uplineName = 'None'
    if (agent.upline_id) {
      const { data: upline } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', agent.upline_id)
        .single()
      uplineName = upline ? `${upline.last_name}, ${upline.first_name}` : 'None'
    }

    // Count downlines
    const { count: downlineCount, error: downlineError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('upline_id', agentId)

    if (downlineError) {
      console.error('Downlines count error:', downlineError)
    }

    // Generate random earnings between $50 and $500
    const randomEarnings = Math.floor(Math.random() * 451) + 50
    const totalProd = parseFloat(agent.total_prod?.toString() || '0')
    const earnings = `$${randomEarnings.toFixed(2)} / $${totalProd.toFixed(2)}`

    // Generate random last login date (max 2 days before today)
    const today = new Date()
    const maxDaysAgo = 2
    const randomDaysAgo = Math.floor(Math.random() * (maxDaysAgo + 1))
    const lastLoginDate = new Date(today)
    lastLoginDate.setDate(today.getDate() - randomDaysAgo)
    const lastLogin = lastLoginDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    const formattedAgent = {
      id: agent.id,
      name: `${agent.last_name}, ${agent.first_name}`,
      position: positionName,
      upline: uplineName,
      created: new Date(agent.created_at || '').toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
      lastLogin: lastLogin,
      earnings: earnings,
      downlines: downlineCount || 0,
      status: agent.is_active ? 'Active' : 'Inactive',
      badge: positionName
    }

    return NextResponse.json(formattedAgent)

  } catch (error) {
    console.error('API Error in agent by ID:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching agent'
    }, { status: 500 })
  }
} 