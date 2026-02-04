// API ROUTE: /api/upload-policy-reports/bucket
// This endpoint proxies policy report uploads to Django backend.
// Files are organized by agency_id and carrier name in Supabase Storage.
//
// SECURITY: This endpoint should be rate-limited to prevent abuse.
// Rate limiting is handled at the infrastructure level (Vercel/Cloudflare).
// Recommended limit: 20 uploads per day per user.

import { getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Main POST handler for the upload-policy-reports endpoint
 * Proxies the upload to Django backend
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate via session
    const session = await getSession()
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'User authentication failed' },
        { status: 401 }
      )
    }

    // Forward the multipart form data to Django
    const formData = await request.formData()

    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/ingest/policy-report-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
      body: formData,
    })

    const data = await response.json()

    return NextResponse.json(data, { status: response.status })

  } catch (error) {
    console.error('Upload policy reports API error:', error)

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        detail: error instanceof Error ? error.message : 'An unexpected error occurred during file upload'
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler for retrieving file information
 * Proxies to Django backend
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate via session
    const session = await getSession()
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'User authentication failed' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const carrier = searchParams.get('carrier')

    const apiUrl = getApiBaseUrl()
    const queryString = carrier ? `?carrier=${encodeURIComponent(carrier)}` : ''

    const response = await fetch(`${apiUrl}/api/ingest/policy-report-files${queryString}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    return NextResponse.json(data, { status: response.status })

  } catch (error) {
    console.error('Get policy reports API error:', error)

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        detail: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE handler for removing files
 * Proxies to Django backend
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate via session
    const session = await getSession()
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'User authentication failed' },
        { status: 401 }
      )
    }

    const body = await request.json()

    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/ingest/policy-report-files`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    return NextResponse.json(data, { status: response.status })

  } catch (error) {
    console.error('Delete policy reports API error:', error)

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        detail: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
