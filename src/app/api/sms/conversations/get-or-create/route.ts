/**
 * Get or Create Conversation API Route
 * Proxies to Django backend for conversation management.
 *
 * POST: Check if conversation exists for a deal
 * PUT: Create a conversation for a deal
 */

import { NextRequest, NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dealId } = body

    if (!dealId) {
      return NextResponse.json(
        { error: 'Missing required field: dealId' },
        { status: 400 }
      )
    }

    // Proxy to Django get-or-create endpoint
    // Django expects snake_case: deal_id
    return proxyToBackend(request, '/api/sms/conversations/get-or-create', {
      method: 'POST',
      body: { deal_id: dealId },
    })
  } catch (error) {
    console.error('Get or create conversation error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to process request',
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { dealId, agentId } = body

    if (!dealId || !agentId) {
      return NextResponse.json(
        { error: 'Missing required fields: dealId, agentId' },
        { status: 400 }
      )
    }

    // Proxy to Django - create conversation
    // Django expects snake_case: deal_id, agent_id
    return proxyToBackend(request, '/api/sms/conversations/get-or-create', {
      method: 'POST',
      body: { deal_id: dealId, agent_id: agentId },
    })
  } catch (error) {
    console.error('Create conversation error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create conversation',
      },
      { status: 500 }
    )
  }
}
