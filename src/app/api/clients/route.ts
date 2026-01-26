import { NextResponse } from 'next/server'
import { getClientEndpoint } from '@/lib/api-config'
import { getAccessToken } from '@/lib/session'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const view = searchParams.get('view') || 'downlines' // 'all', 'self', 'downlines'

    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(getClientEndpoint('list'))
    url.searchParams.set('page', page.toString())
    url.searchParams.set('limit', limit.toString())
    url.searchParams.set('view', view)

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Clients API error:', errorData)
      return NextResponse.json(
        { error: errorData.error || 'Failed to fetch clients' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Transform API response to match frontend expected format
    const clients = (data.clients || data.results || []).map((client: any) => ({
      id: client.id || client.client_id,
      name: client.name || client.client_name || `${client.first_name || ''} ${client.last_name || ''}`.trim(),
      email: client.email || client.client_email || 'N/A',
      phone: client.phone || client.client_phone || 'N/A',
      supportingAgent: client.supporting_agent || client.agent_name || 'N/A',
      status: client.status || 'N/A',
      created: client.created_at
        ? new Date(client.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        : 'N/A'
    }))

    const totalCount = data.pagination?.totalCount || data.total_count || data.count || clients.length
    const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 0

    return NextResponse.json({
      clients,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit
      }
    })
  } catch (error: any) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
