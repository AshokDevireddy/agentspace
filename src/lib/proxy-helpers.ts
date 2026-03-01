/**
 * BFF Proxy Helpers
 *
 * Forwards requests from Next.js API routes to the Django backend.
 * Handles auth (cookie → Bearer), case conversion (camelCase ↔ snake_case),
 * and returns NextResponse with camelCase JSON.
 */

import { NextRequest, NextResponse } from 'next/server'
import camelcaseKeys from 'camelcase-keys'
import snakecaseKeys from 'snakecase-keys'
import { getApiBaseUrl } from '@/lib/api-config'

const CAMELCASE_OPTIONS = { deep: true, exclude: [/^\d{4}-\d{2}-\d{2}$/] } as const

function getToken(request: NextRequest): string | null {
  // Try cookie first, then Authorization header
  const cookie = request.cookies.get('access_token')?.value
  if (cookie) return cookie

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

function buildDjangoUrl(path: string, searchParams?: URLSearchParams): string {
  const base = getApiBaseUrl()
  const normalized = path.endsWith('/') ? path : `${path}/`
  const qs = searchParams?.toString()
  return qs ? `${base}${normalized}?${qs}` : `${base}${normalized}`
}

async function forwardResponse(response: Response): Promise<NextResponse> {
  const text = await response.text()
  if (!text) {
    return NextResponse.json(null, { status: response.status })
  }

  try {
    const data = JSON.parse(text)
    const camelCased = camelcaseKeys(data, CAMELCASE_OPTIONS)
    return NextResponse.json(camelCased, { status: response.status })
  } catch {
    return new NextResponse(text, { status: response.status })
  }
}

/**
 * Proxy a GET request to Django. Forwards all query params as-is.
 */
export async function proxyGet(
  request: NextRequest,
  djangoPath: string,
): Promise<NextResponse> {
  const token = getToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const url = buildDjangoUrl(djangoPath, searchParams)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    return forwardResponse(response)
  } catch (err) {
    console.error(`[proxyGet] Failed to reach Django at ${url}:`, err)
    return NextResponse.json(
      { error: 'Backend service unavailable', detail: String(err) },
      { status: 502 }
    )
  }
}

/**
 * Proxy a POST request to Django. Converts body keys to snake_case.
 */
export async function proxyPost(
  request: NextRequest,
  djangoPath: string,
): Promise<NextResponse> {
  const token = getToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const snakeCased = snakecaseKeys(body, { deep: true })
  const url = buildDjangoUrl(djangoPath)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snakeCased),
  })

  return forwardResponse(response)
}

/**
 * Proxy a PUT request to Django. Converts body keys to snake_case.
 */
export async function proxyPut(
  request: NextRequest,
  djangoPath: string,
): Promise<NextResponse> {
  const token = getToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const snakeCased = snakecaseKeys(body, { deep: true })
  const url = buildDjangoUrl(djangoPath)

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snakeCased),
  })

  return forwardResponse(response)
}

/**
 * Proxy a DELETE request to Django.
 */
export async function proxyDelete(
  request: NextRequest,
  djangoPath: string,
): Promise<NextResponse> {
  const token = getToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = buildDjangoUrl(djangoPath)

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  return forwardResponse(response)
}
