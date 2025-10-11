// API ROUTE: /api/contracts
// This endpoint fetches all contracts with their related data including carrier names and agent names

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const supabase = createAdminClient()

    // First, get total count of agent_carrier_numbers (as contracts replacement)
    const { count: totalCount, error: countError } = await supabase
      .from('agent_carrier_numbers')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Contracts count error:', countError)
      return NextResponse.json({
        error: 'Failed to count contracts',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    // Get paginated agent_carrier_numbers with their basic information
    const { data: contracts, error: contractsError } = await supabase
      .from('agent_carrier_numbers')
      .select(`
        id,
        start_date,
        carrier_id,
        agent_id,
        loa,
        is_active,
        agent_number
      `)
      .order('start_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (contractsError) {
      console.error('Contracts fetch error:', contractsError)
      return NextResponse.json({
        error: 'Failed to fetch contracts',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    if (!contracts || contracts.length === 0) {
      return NextResponse.json({
        contracts: [],
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

    // Get all carrier IDs to fetch carrier names
    const carrierIds = contracts
      .map(contract => contract.carrier_id)
      .filter(id => id !== null) as string[]

    // Fetch carrier names
    const { data: carriers, error: carriersError } = await supabase
      .from('carriers')
      .select('id, name, display_name')
      .in('id', carrierIds)

    if (carriersError) {
      console.error('Carriers fetch error:', carriersError)
      return NextResponse.json({
        error: 'Failed to fetch carriers',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    // Create a map of carrier IDs to names
    const carrierMap = new Map(
      carriers?.map(carrier => [carrier.id, carrier.display_name || carrier.name]) || []
    )

    // Get all agent IDs to fetch agent names
    const agentIds = contracts
      .map(contract => contract.agent_id)
      .filter(id => id !== null) as string[]

    // Fetch agent names
    const { data: agents, error: agentsError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', agentIds)

    if (agentsError) {
      console.error('Agents fetch error:', agentsError)
      return NextResponse.json({
        error: 'Failed to fetch agents',
        detail: 'Database query encountered an error'
      }, { status: 500 })
    }

    // Create a map of agent IDs to names
    const agentMap = new Map(
      agents?.map(agent => [agent.id, `${agent.last_name}, ${agent.first_name}`]) || []
    )

    // Transform contracts to match the expected format
    const formattedContracts = contracts.map(contract => {
      const carrierName = carrierMap.get(contract.carrier_id) || 'Unknown'
      const agentName = agentMap.get(contract.agent_id) || 'Unknown'

      return {
        id: contract.id,
        carrier: carrierName,
        agent: agentName,
        loa: contract.loa || 'None',
        status: contract.is_active ? 'Active' : 'Inactive',
        startDate: contract.start_date ? new Date(contract.start_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) : '—',
        agentNumber: contract.agent_number
      }
    })

    const totalPages = Math.ceil((totalCount || 0) / limit)

    return NextResponse.json({
      contracts: formattedContracts,
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
    console.error('API Error in contracts:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching contracts'
    }, { status: 500 })
  }
}