import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the user's profile to find their agency_id
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('agency_id, role, perm_level')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      )
    }

    const { agency_id } = userProfile

    if (!agency_id) {
      return NextResponse.json(
        { success: false, error: 'User not associated with an agency' },
        { status: 400 }
      )
    }

    // Get date range from query params (default to current week)
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate') || getWeekStart()
    const endDate = searchParams.get('endDate') || getWeekEnd()

    // Fetch all agents in the agency (only admin and agents, not clients)
    const { data: agents, error: agentsError } = await supabase
      .from('users')
      .select('id, first_name, last_name, role, perm_level')
      .eq('agency_id', agency_id)
      .in('perm_level', ['admin', 'agent'])
      .eq('is_active', true)

    if (agentsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch agents' },
        { status: 500 }
      )
    }

    // Fetch all deals for the agency within the date range
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('agent_id, annual_premium, payment_cycle_premium, billing_cycle, policy_effective_date, status')
      .eq('agency_id', agency_id)
      .gte('policy_effective_date', startDate)
      .lte('policy_effective_date', endDate)
      .in('status', ['active', 'approved', 'issued']) // Only count active/approved deals
      .not('policy_effective_date', 'is', null)

    if (dealsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch deals' },
        { status: 500 }
      )
    }

    // Calculate revenue for each agent
    const agentStats = new Map<string, {
      agent_id: string
      name: string
      total: number
      dailyBreakdown: { [date: string]: number }
      dealCount: number
    }>()

    // Initialize all agents with 0
    agents?.forEach(agent => {
      agentStats.set(agent.id, {
        agent_id: agent.id,
        name: `${agent.first_name} ${agent.last_name}`,
        total: 0,
        dailyBreakdown: {},
        dealCount: 0
      })
    })

    // Calculate revenue from deals
    deals?.forEach(deal => {
      const agentStat = agentStats.get(deal.agent_id)
      if (!agentStat) return // Skip if agent not in our list

      // Use annual_premium as the base revenue for each deal
      const revenue = Number(deal.annual_premium) || 0

      agentStat.total += revenue
      agentStat.dealCount += 1

      // Add to daily breakdown
      const effectiveDate = deal.policy_effective_date
      if (effectiveDate) {
        if (!agentStat.dailyBreakdown[effectiveDate]) {
          agentStat.dailyBreakdown[effectiveDate] = 0
        }
        agentStat.dailyBreakdown[effectiveDate] += revenue
      }
    })

    // Convert to array and sort by total (descending)
    const leaderboard = Array.from(agentStats.values())
      .filter(stat => stat.dealCount > 0) // Only include agents with deals
      .sort((a, b) => b.total - a.total)
      .map((stat, index) => ({
        rank: index + 1,
        ...stat
      }))

    // Calculate overall stats
    const totalProduction = leaderboard.reduce((sum, agent) => sum + agent.total, 0)
    const totalDeals = leaderboard.reduce((sum, agent) => sum + agent.dealCount, 0)
    const activeAgents = leaderboard.length

    return NextResponse.json({
      success: true,
      data: {
        leaderboard,
        stats: {
          totalProduction,
          totalDeals,
          activeAgents
        },
        dateRange: {
          startDate,
          endDate
        }
      }
    })

  } catch (error) {
    console.error('Scoreboard API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to get the start of the current week (Sunday)
function getWeekStart(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = now.getDate() - dayOfWeek
  const sunday = new Date(now.setDate(diff))
  sunday.setHours(0, 0, 0, 0)
  return sunday.toISOString().split('T')[0]
}

// Helper function to get the end of the current week (Saturday)
function getWeekEnd(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = now.getDate() - dayOfWeek + 6
  const saturday = new Date(now.setDate(diff))
  saturday.setHours(23, 59, 59, 999)
  return saturday.toISOString().split('T')[0]
}

