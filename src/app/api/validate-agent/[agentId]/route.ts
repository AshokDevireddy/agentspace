// API ROUTE: /api/validate-agent/[agentId]
// This endpoint validates if a specific agent ID exists and is active
// Used during form validation to ensure selected upline agents are valid
// Proxies to Django backend endpoint GET /api/agents/{id}/

import { NextResponse } from 'next/server'
import { getApiBaseUrl } from '@/lib/api-config'
import { getAccessToken } from '@/lib/session'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params

    // Validate agent ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!agentId || !uuidRegex.test(agentId)) {
      return NextResponse.json({
        exists: false,
        error: 'Invalid agent ID format'
      }, { status: 400 })
    }

    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({ exists: false, error: 'Unauthorized' }, { status: 401 })
    }

    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/agents/${agentId}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      // Agent doesn't exist or not accessible
      return NextResponse.json({ exists: false })
    }

    const agent = await response.json()

    // Check if agent is active
    const isActive = agent.status === 'active' || agent.isActive === true

    return NextResponse.json({
      exists: isActive,
      agentId: isActive ? agent.id : undefined
    })

  } catch (error) {
    console.error('API Error in validate-agent:', error)
    return NextResponse.json({
      exists: false,
      error: 'Internal Server Error'
    }, { status: 500 })
  }
}
