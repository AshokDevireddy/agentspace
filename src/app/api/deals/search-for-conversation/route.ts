// API ROUTE: /api/deals/search-for-conversation
// Proxies to Django backend for searching deals for conversation creation

import { proxyToBackend } from '@/lib/api-proxy'
import { NextRequest, NextResponse } from 'next/server'

interface DjangoDealsResponse {
  deals: Array<{
    id: string
    agentId: string
    clientName: string
    clientPhone: string | null
    carrierName: string | null
    productName: string | null
    policyNumber: string | null
    status: string | null
    agentFirstName: string | null
    agentLastName: string | null
  }>
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientName = searchParams.get('client_name')
  const clientPhone = searchParams.get('client_phone')
  const limit = searchParams.get('limit') || '20'

  // At least one search parameter must be provided
  if (!clientName && !clientPhone) {
    return NextResponse.json({ error: 'Must provide client_name or client_phone' }, { status: 400 })
  }

  // Build params for Django book-of-business endpoint
  const params = new URLSearchParams()
  params.set('limit', limit)

  if (clientName) {
    params.set('search', clientName)
  }
  if (clientPhone) {
    params.set('client_phone', clientPhone)
  }

  // Proxy to Django with custom params
  const response = await proxyToBackend(req, '/api/deals/', {
    method: 'GET',
    searchParams: params,
  })

  // Check if the response is ok
  if (!response.ok) {
    return response
  }

  // Transform Django response to match expected format
  // Note: proxyToBackend already transforms snake_case to camelCase
  try {
    const data: DjangoDealsResponse = await response.json()
    const deals = (data.deals || []).map((deal) => ({
      id: deal.id,
      agentId: deal.agentId,
      clientName: deal.clientName,
      clientPhone: deal.clientPhone || '',
      carrier: deal.carrierName || 'Unknown Carrier',
      product: deal.productName || 'Unknown Product',
      policyNumber: deal.policyNumber || '',
      status: deal.status || 'draft',
      agent: deal.agentLastName
        ? `${deal.agentLastName}, ${deal.agentFirstName || 'Agent'}`
        : 'Unknown Agent',
    }))

    return NextResponse.json({ deals }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to process response' }, { status: 500 })
  }
}
