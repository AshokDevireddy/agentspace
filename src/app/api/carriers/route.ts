// API ROUTE: /api/carriers
// This endpoint fetches all carriers
// Proxies to Django backend endpoint GET /api/carriers/
// Supports ?filter=nipr to filter carriers by NIPR unique_carriers fuzzy matching

import { NextRequest, NextResponse } from 'next/server'
import camelcaseKeys from 'camelcase-keys'
import { getApiBaseUrl } from '@/lib/api-config'
import { getAccessToken } from '@/lib/session'

type Carrier = {
  id: string
  name: string
  displayName?: string | null
  isActive?: boolean
  createdAt?: string | null
}

/** Levenshtein distance between two strings */
function levenshteinDistance(s1: string, s2: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= s1.length; i++) matrix[i] = [i]
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[s1.length][s2.length]
}

/** Calculate similarity (0-1) between two strings */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()
  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0
  const distance = levenshteinDistance(s1, s2)
  return 1 - distance / Math.max(s1.length, s2.length)
}

/** Find carriers matching NIPR carriers by fuzzy name comparison */
function findMatchingCarrierIds(
  niprCarriers: string[],
  carriers: Carrier[],
  threshold = 0.8
): Set<string> {
  const matchedIds = new Set<string>()
  for (const niprName of niprCarriers) {
    for (const carrier of carriers) {
      const nameSim = calculateSimilarity(niprName, carrier.name)
      const displaySim = carrier.displayName
        ? calculateSimilarity(niprName, carrier.displayName)
        : 0
      if (Math.max(nameSim, displaySim) >= threshold) {
        matchedIds.add(carrier.id)
      }
    }
  }
  return matchedIds
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
    const matchedIds = findMatchingCarrierIds(uniqueCarriers, carriers, 0.8)

    // Return matched carriers in the same format as original response
    const filteredCarriers = carriers.filter(c => matchedIds.has(c.id))

    return NextResponse.json(filteredCarriers)

  } catch (error) {
    console.error('API Error in carriers:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred while fetching carriers'
    }, { status: 500 })
  }
}
