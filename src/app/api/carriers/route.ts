// API ROUTE: /api/carriers
// This endpoint fetches all carriers
// Proxies to Django backend endpoint GET /api/carriers/
// Supports ?filter=nipr to filter carriers by NIPR unique_carriers fuzzy matching

import { NextRequest, NextResponse } from 'next/server'
import camelcaseKeys from 'camelcase-keys'
import { getApiBaseUrl } from '@/lib/api-config'
import { getAccessToken } from '@/lib/session'
import { findMatchingCarriers, type ActiveCarrier } from '@/lib/nipr/fuzzy-match'

type Carrier = {
  id: string
  name: string
  displayName?: string | null
  isActive?: boolean
  createdAt?: string | null
}

export async function GET(request: NextRequest) {
  try {
    // Check if NIPR filtering is requested
    const filterByNipr = request.nextUrl.searchParams.get('filter') === 'nipr'

    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiUrl = getApiBaseUrl()

    // Fetch carriers from Django backend
    const response = await fetch(`${apiUrl}/api/carriers/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(errorData, { status: response.status })
    }

    const rawCarriers = await response.json()
    const carriers: Carrier[] = rawCarriers ? camelcaseKeys(rawCarriers, { deep: true }) : []

    // If no NIPR filter requested, return all carriers
    if (!filterByNipr) {
      return NextResponse.json(carriers || [])
    }

    // Get user profile for unique_carriers
    const profileResponse = await fetch(`${apiUrl}/api/user/profile/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!profileResponse.ok) {
      // No profile accessible - return all carriers
      return NextResponse.json(carriers || [])
    }

    const profile = await profileResponse.json()
    const uniqueCarriers: string[] = profile.unique_carriers || profile.uniqueCarriers || []

    // If no unique_carriers, return all carriers (backwards compatibility)
    if (uniqueCarriers.length === 0) {
      return NextResponse.json(carriers || [])
    }

    // Fuzzy match carriers at 80% threshold
    const activeCarriers: ActiveCarrier[] = (carriers || []).map(c => ({
      id: c.id,
      name: c.name,
      display_name: c.displayName || c.name
    }))

    const matchedCarriers = findMatchingCarriers(uniqueCarriers, activeCarriers, 0.8)

    // Return matched carriers in the same format as original response
    const filteredCarriers = matchedCarriers.map(m => {
      const original = carriers?.find(c => c.id === m.id)
      return original || { id: m.id, name: m.name, displayName: m.display_name, isActive: true, createdAt: null }
    })

    return NextResponse.json(filteredCarriers)

  } catch (error) {
    console.error('API Error in carriers:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching carriers'
    }, { status: 500 })
  }
}
