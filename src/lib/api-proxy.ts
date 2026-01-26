/**
 * API Proxy Utilities
 *
 * Provides helper functions for proxying Next.js API routes to the backend.
 * Reads the access token from the httpOnly session cookie.
 * Transforms snake_case responses to camelCase for frontend consumption.
 */

import { NextResponse } from 'next/server'
import camelcaseKeys from 'camelcase-keys'
import { getApiBaseUrl } from './api-config'
import { getAccessToken } from './session'

type ProxyOptions = {
  /** HTTP method (defaults to GET) */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Request body for POST/PUT/PATCH */
  body?: unknown
  /** Additional headers to include */
  headers?: Record<string, string>
  /** Query parameters to append to the URL */
  searchParams?: URLSearchParams | Record<string, string>
  /** Skip authentication (for public endpoints) */
  skipAuth?: boolean
}

/**
 * Proxy a request to the backend API
 * Automatically includes the access token from the httpOnly session cookie.
 *
 * @param request - The incoming Next.js request
 * @param endpoint - The backend API endpoint (e.g., '/api/agents')
 * @param options - Additional options for the request
 * @returns NextResponse with the backend response
 */
export async function proxyToBackend(
  request: Request,
  endpoint: string,
  options: ProxyOptions = {}
): Promise<NextResponse> {
  const { method = 'GET', body, headers: extraHeaders = {}, searchParams, skipAuth = false } = options

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }

  // Get auth token from httpOnly session cookie
  if (!skipAuth) {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  // Build URL with query params
  const apiUrl = getApiBaseUrl()
  let url = `${apiUrl}${endpoint}`

  if (searchParams) {
    const params = searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v !== null && v !== undefined))
    const queryString = params.toString()
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })

    const data = await response.json().catch(() => null)

    // Transform snake_case to camelCase for frontend consumption
    const transformedData = data ? camelcaseKeys(data, { deep: true }) : data

    // Return response with same status code
    return NextResponse.json(transformedData, { status: response.status })
  } catch (error) {
    console.error(`[API Proxy] Error proxying to ${endpoint}:`, error)
    return NextResponse.json(
      { error: 'Internal Server Error', detail: 'Failed to communicate with backend' },
      { status: 500 }
    )
  }
}

/**
 * Forward the incoming request's query params to the backend
 *
 * @param request - The incoming Next.js request
 * @param endpoint - The backend API endpoint
 * @returns NextResponse with the backend response
 */
export async function proxyGetWithParams(
  request: Request,
  endpoint: string
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  return proxyToBackend(request, endpoint, { method: 'GET', searchParams })
}

/**
 * Forward a POST request to the backend
 *
 * @param request - The incoming Next.js request
 * @param endpoint - The backend API endpoint
 * @returns NextResponse with the backend response
 */
export async function proxyPost(
  request: Request,
  endpoint: string
): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, endpoint, { method: 'POST', body })
}

/**
 * Forward a PUT request to the backend
 */
export async function proxyPut(
  request: Request,
  endpoint: string
): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, endpoint, { method: 'PUT', body })
}

/**
 * Forward a PATCH request to the backend
 */
export async function proxyPatch(
  request: Request,
  endpoint: string
): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, endpoint, { method: 'PATCH', body })
}

/**
 * Forward a DELETE request to the backend
 */
export async function proxyDelete(
  request: Request,
  endpoint: string
): Promise<NextResponse> {
  return proxyToBackend(request, endpoint, { method: 'DELETE' })
}
