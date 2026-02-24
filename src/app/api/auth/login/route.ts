import { NextRequest, NextResponse } from 'next/server'
import camelcaseKeys from 'camelcase-keys'
import { createSession } from '@/lib/session'
import { getApiBaseUrl, authEndpoints } from '@/lib/api-config'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Call Django backend for authentication
    const response = await fetch(`${getApiBaseUrl()}${authEndpoints.login}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(error, { status: response.status })
    }

    const data = await response.json()

    // Create httpOnly session cookie with tokens
    await createSession({
      userId: data.user.id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    })

    // Return user data (NOT tokens - they're in the httpOnly cookie)
    return NextResponse.json(camelcaseKeys({
      user: data.user,
      agency: data.agency,
    }, { deep: true }))
  } catch (error) {
    console.error('[API/auth/login] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'Login failed' },
      { status: 500 }
    )
  }
}
