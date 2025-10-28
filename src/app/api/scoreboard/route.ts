import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, agency_id, role, perm_level')
      .eq('auth_user_id', user.id as any)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      )
    }

    const profile = userProfile as any
    const agency_id = profile.agency_id

    if (!agency_id) {
      return NextResponse.json(
        { success: false, error: 'User not associated with an agency' },
        { status: 400 }
      )
    }

    const isAdmin = profile.role === 'admin'

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate') || getWeekStart()
    const endDate = searchParams.get('endDate') || getWeekEnd()

    let agentIds: string[]

    if (isAdmin) {
      const { data: allAgents, error: allAgentsError } = await supabase
        .from('users')
        .select('id')
        .eq('agency_id', agency_id as any)
        .in('role', ['admin', 'agent'] as any)
        .eq('is_active', true as any)

      if (allAgentsError) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch agents' },
          { status: 500 }
        )
      }

      agentIds = allAgents?.map(a => (a as any).id as string) || []
    } else {
      const { data: downline, error: downlineError } = await supabase.rpc('get_agent_downline', {
        agent_id: profile.id as any
      })

      if (downlineError) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch downline' },
          { status: 500 }
        )
      }

      agentIds = [profile.id as string, ...((downline as any[])?.map((u: any) => u.id) || [])]
    }

    let agents: any[]
    let agentsError: any

    if (isAdmin) {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .eq('agency_id', agency_id as any)
        .in('role', ['admin', 'agent'] as any)
        .eq('is_active', true as any)

      agents = data || []
      agentsError = error
    } else {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .in('id', agentIds as any)

      agents = data || []
      agentsError = error
    }

    if (agentsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch agents' },
        { status: 500 }
      )
    }
    let allDeals: any[]
    let dealsError: any

    // Calculate the earliest possible effective date that could have payments in the range
    // Go back 12 months from the start date to capture all potential recurring payments
    const earliestDate = new Date(startDate + 'T00:00:00')
    earliestDate.setFullYear(earliestDate.getFullYear() - 1)
    const lookbackStartDate = earliestDate.toISOString().split('T')[0]

    if (isAdmin) {
      const { data, error } = await supabase
        .from('deals')
        .select('agent_id, carrier_id, annual_premium, payment_cycle_premium, billing_cycle, policy_effective_date, status')
        .eq('agency_id', agency_id as any)
        .gte('policy_effective_date', lookbackStartDate as any)
        .lte('policy_effective_date', endDate as any)
        .not('policy_effective_date', 'is', null)

      allDeals = data || []
      dealsError = error
    } else {
      const { data, error } = await supabase
        .from('deals')
        .select('agent_id, carrier_id, annual_premium, payment_cycle_premium, billing_cycle, policy_effective_date, status')
        .in('agent_id', agentIds as any)
        .gte('policy_effective_date', lookbackStartDate as any)
        .lte('policy_effective_date', endDate as any)
        .not('policy_effective_date', 'is', null)

      allDeals = data || []
      dealsError = error
    }

    if (dealsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch deals' },
        { status: 500 }
      )
    }

    const carrierIds = new Set<string>()
    const rawStatuses = new Set<string>()

    allDeals?.forEach(deal => {
      if (deal.carrier_id && deal.status) {
        carrierIds.add(deal.carrier_id)
        rawStatuses.add(deal.status)
      }
    })

    const { data: statusMappings, error: mappingError } = await supabase
      .from('status_mapping')
      .select('carrier_id, raw_status, impact')
      .in('carrier_id', Array.from(carrierIds) as any)
      .in('raw_status', Array.from(rawStatuses) as any)

    if (mappingError) {
      console.error('Error fetching status mappings:', mappingError)
    }

    const impactMap = new Map<string, string>()
    statusMappings?.forEach((mapping: any) => {
      const key = `${mapping.carrier_id}|${mapping.raw_status}`
      impactMap.set(key, mapping.impact)
    })

    const deals = allDeals?.filter(deal => {
      if (!deal.carrier_id || !deal.status) return false
      const key = `${deal.carrier_id}|${deal.status}`
      const impact = impactMap.get(key)
      return impact === 'positive'
    }) || []

    const agentStats = new Map<string, {
      agent_id: string
      name: string
      total: number
      dailyBreakdown: { [date: string]: number }
      dealCount: number
    }>()

    agents?.forEach(agent => {
      agentStats.set(agent.id, {
        agent_id: agent.id,
        name: `${agent.first_name} ${agent.last_name}`,
        total: 0,
        dailyBreakdown: {},
        dealCount: 0
      })
    })

    // Get today's date to exclude future dates
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    deals?.forEach(deal => {
      const agentStat = agentStats.get(deal.agent_id)
      if (!agentStat) return

      const annualPremium = Number(deal.annual_premium) || 0
      if (annualPremium === 0) return

      const billingCycle = deal.billing_cycle || 'monthly'
      const effectiveDate = deal.policy_effective_date
      if (!effectiveDate) return

      // Calculate payment amount and frequency based on billing cycle
      let paymentAmount: number
      let monthsInterval: number

      switch (billingCycle.toLowerCase()) {
        case 'monthly':
          paymentAmount = annualPremium / 12
          monthsInterval = 1
          break
        case 'quarterly':
          paymentAmount = annualPremium / 4
          monthsInterval = 3
          break
        case 'semi-annually':
          paymentAmount = annualPremium / 2
          monthsInterval = 6
          break
        case 'annually':
          paymentAmount = annualPremium
          monthsInterval = 12
          break
        default:
          paymentAmount = annualPremium / 12
          monthsInterval = 1
      }

      // Generate payment dates within the date range
      const rangeStart = new Date(startDate + 'T00:00:00')
      const rangeEnd = new Date(endDate + 'T00:00:00')
      const effective = new Date(effectiveDate + 'T00:00:00')

      // Use the earlier of rangeEnd or today to prevent counting future dates
      const calculationEnd = rangeEnd < today ? rangeEnd : today

      let hasPaymentInRange = false

      // Generate payment dates for up to 12 payments (1 year)
      for (let i = 0; i < 12; i++) {
        const paymentDate = new Date(effective)
        paymentDate.setMonth(effective.getMonth() + (i * monthsInterval))

        // Check if payment date is within the selected range AND not in the future
        if (paymentDate >= rangeStart && paymentDate <= calculationEnd) {
          const paymentDateStr = paymentDate.toISOString().split('T')[0]

          if (!agentStat.dailyBreakdown[paymentDateStr]) {
            agentStat.dailyBreakdown[paymentDateStr] = 0
          }
          agentStat.dailyBreakdown[paymentDateStr] += paymentAmount
          agentStat.total += paymentAmount
          hasPaymentInRange = true
        }

        // Stop if we've gone past the calculation end (which is limited by today)
        if (paymentDate > calculationEnd) break
      }

      // Count this deal only if it contributed any payments in the range
      if (hasPaymentInRange) {
        agentStat.dealCount += 1
      }
    })

    const leaderboard = Array.from(agentStats.values())
      .filter(stat => stat.dealCount > 0)
      .sort((a, b) => b.total - a.total)
      .map((stat, index) => ({
        rank: index + 1,
        ...stat
      }))

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

