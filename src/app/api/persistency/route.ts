import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface PersistencyData {
  activeDealCount: number
  inactiveDealCount: number
  totalDealCount: number
  persistencyRate: number
}

interface PersistencyResponse {
  personal: PersistencyData
  downline: PersistencyData
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('user_id')
    const timeframe = searchParams.get('timeframe') || '3months' // 3months, 6months, 9months, alltime

    console.log('=== PERSISTENCY API START ===')
    console.log('User ID:', userId)
    console.log('Timeframe:', timeframe)

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Calculate date cutoff based on timeframe
    let dateCutoff: string | null = null
    if (timeframe !== 'alltime') {
      const months = timeframe === '3months' ? 3 : timeframe === '6months' ? 6 : 9
      const cutoffDate = new Date()
      cutoffDate.setMonth(cutoffDate.getMonth() - months)
      dateCutoff = cutoffDate.toISOString().split('T')[0]
    }

    console.log('Date cutoff:', dateCutoff)

    // Get personal persistency data
    console.log('Fetching personal persistency data...')
    const personalData = await getPersonalPersistency(supabase, userId, dateCutoff)
    console.log('Personal data result:', personalData)

    // Get downline persistency data
    console.log('Fetching downline persistency data...')
    const downlineData = await getDownlinePersistency(supabase, userId, dateCutoff)
    console.log('Downline data result:', downlineData)

    const response: PersistencyResponse = {
      personal: personalData,
      downline: downlineData
    }

    console.log('Final response:', response)
    console.log('=== PERSISTENCY API END ===')

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error('Error fetching persistency data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch persistency data' },
      { status: 500 }
    )
  }
}

async function getPersonalPersistency(supabase: any, userId: string, dateCutoff: string | null): Promise<PersistencyData> {
  console.log('--- Getting personal persistency for user:', userId)
  console.log('--- Date cutoff:', dateCutoff)

  // Build the query for personal deals
  let dealsQuery = supabase
    .from('deals')
    .select(`
      id,
      policy_effective_date,
      commissions (
        amount,
        commission_type,
        status
      )
    `)
    .eq('agent_id', userId)

  if (dateCutoff) {
    dealsQuery = dealsQuery.gte('policy_effective_date', dateCutoff)
    console.log('--- Applying date filter >= ', dateCutoff)
  }

  const { data: deals, error } = await dealsQuery

  console.log('--- Personal deals query result:')
  console.log('--- Error:', error)
  console.log('--- Deals count:', deals?.length || 0)
  console.log('--- First few deals:', deals?.slice(0, 3))

  if (error) {
    console.error('--- Query error details:', error)
    throw new Error(`Error fetching personal deals: ${error.message}`)
  }

  const result = calculatePersistencyMetrics(deals || [])
  console.log('--- Personal persistency result:', result)

  return result
}

async function getDownlinePersistency(supabase: any, userId: string, dateCutoff: string | null): Promise<PersistencyData> {
  console.log('--- Getting downline persistency for user:', userId)

  // First, get all downline agents recursively
  const downlineAgents = await getAllDownlineAgents(supabase, userId)
  console.log('--- Downline agents found:', downlineAgents.length)
  console.log('--- Downline agent IDs:', downlineAgents)

  if (downlineAgents.length === 0) {
    console.log('--- No downline agents, returning zero metrics')
    return {
      activeDealCount: 0,
      inactiveDealCount: 0,
      totalDealCount: 0,
      persistencyRate: 0
    }
  }

  // Build the query for downline deals
  let dealsQuery = supabase
    .from('deals')
    .select(`
      id,
      policy_effective_date,
      agent_id,
      commissions (
        amount,
        commission_type,
        status
      )
    `)
    .in('agent_id', downlineAgents)

  if (dateCutoff) {
    dealsQuery = dealsQuery.gte('policy_effective_date', dateCutoff)
    console.log('--- Applying date filter >= ', dateCutoff)
  }

  const { data: deals, error } = await dealsQuery

  console.log('--- Downline deals query result:')
  console.log('--- Error:', error)
  console.log('--- Deals count:', deals?.length || 0)
  console.log('--- First few deals:', deals?.slice(0, 3))

  if (error) {
    console.error('--- Downline query error details:', error)
    throw new Error(`Error fetching downline deals: ${error.message}`)
  }

  const result = calculatePersistencyMetrics(deals || [])
  console.log('--- Downline persistency result:', result)

  return result
}

async function getAllDownlineAgents(supabase: any, userId: string): Promise<string[]> {
  const allDownlines: string[] = []
  const toProcess = [userId]
  const processed = new Set<string>()

  while (toProcess.length > 0) {
    const currentId = toProcess.shift()!

    if (processed.has(currentId)) {
      continue
    }
    processed.add(currentId)

    // Get direct downlines
    const { data: downlines, error } = await supabase
      .from('users')
      .select('id')
      .eq('upline_id', currentId)
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching downlines:', error)
      continue
    }

    for (const downline of downlines || []) {
      allDownlines.push(downline.id)
      toProcess.push(downline.id)
    }
  }

  return allDownlines
}

function calculatePersistencyMetrics(deals: any[]): PersistencyData {
  console.log('--- Calculating persistency metrics for', deals.length, 'deals')

  if (deals.length === 0) {
    console.log('--- No deals to process, returning zero metrics')
    return {
      activeDealCount: 0,
      inactiveDealCount: 0,
      totalDealCount: 0,
      persistencyRate: 0
    }
  }

  let activeDealCount = 0
  let inactiveDealCount = 0

  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i]
    const isActive = isDealActive(deal)

    console.log(`--- Deal ${i + 1}:`, {
      id: deal.id,
      policy_effective_date: deal.policy_effective_date,
      commissions_count: deal.commissions?.length || 0,
      isActive
    })

    if (isActive) {
      activeDealCount++
    } else {
      inactiveDealCount++
    }
  }

  const totalDealCount = activeDealCount + inactiveDealCount
  const persistencyRate = totalDealCount > 0 ? (activeDealCount / totalDealCount) * 100 : 0

  const result = {
    activeDealCount,
    inactiveDealCount,
    totalDealCount,
    persistencyRate: Math.round(persistencyRate * 100) / 100 // Round to 2 decimal places
  }

  console.log('--- Final calculated metrics:', result)
  return result
}

function isDealActive(deal: any): boolean {
  const commissions = deal.commissions || []

  console.log(`--- Checking if deal ${deal.id} is active:`)
  console.log('--- Commissions:', commissions.length)

  // If no commissions exist, check if it's been more than a week since policy effective date
  if (commissions.length === 0) {
    console.log('--- No commissions found')

    if (!deal.policy_effective_date) {
      console.log('--- No effective date, marking inactive')
      return false // No effective date, consider inactive
    }

    const effectiveDate = new Date(deal.policy_effective_date)
    const oneWeekLater = new Date(effectiveDate)
    oneWeekLater.setDate(oneWeekLater.getDate() + 7)

    const now = new Date()

    console.log('--- Effective date:', effectiveDate.toISOString())
    console.log('--- One week later:', oneWeekLater.toISOString())
    console.log('--- Now:', now.toISOString())

    // If more than a week has passed with no commissions, it's inactive
    if (now > oneWeekLater) {
      console.log('--- More than a week has passed, marking inactive')
      return false
    }

    console.log('--- Less than a week, marking active')
    // Less than a week, still potentially active
    return true
  }

  console.log('--- Commission details:', commissions.map((c: any) => ({
    amount: c.amount,
    type: c.commission_type,
    status: c.status
  })))

  // Check if any commission has a negative amount (chargeback)
  const hasChargeback = commissions.some((commission: any) =>
    commission.amount < 0 || commission.commission_type === 'chargeback'
  )

  console.log('--- Has chargeback:', hasChargeback)

  if (hasChargeback) {
    console.log('--- Has chargeback, marking inactive')
    return false // Has chargeback, inactive
  }

  // Check if deal has been placed (has positive commissions that aren't chargebacks)
  const hasPositiveCommissions = commissions.some((commission: any) =>
    commission.amount > 0 && commission.commission_type !== 'chargeback'
  )

  console.log('--- Has positive commissions:', hasPositiveCommissions)

  return hasPositiveCommissions
}
