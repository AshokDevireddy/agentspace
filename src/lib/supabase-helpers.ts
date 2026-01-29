/**
 * API Helper Functions
 *
 * These functions call the Django backend through Next.js API routes.
 * They maintain the same interface as the original Supabase helpers
 * for backwards compatibility.
 */

/**
 * Internal helper to call Next.js API routes with credentials.
 * These routes handle auth via httpOnly cookies.
 */
async function apiCall<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    body?: unknown
    params?: Record<string, string | undefined>
  } = {}
): Promise<T> {
  const { method = 'GET', body, params } = options

  // Build URL with query params
  let url = `/api${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, value)
      }
    })
    const queryString = searchParams.toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }

  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.message || `API call failed: ${response.status}`)
  }

  return response.json()
}

// Get current user with admin status
export async function getCurrentUser() {
  try {
    const data = await apiCall<{
      id: string
      email: string
      firstName: string
      lastName: string
      agencyId: string
      agencyName: string
      role: string
      isAdmin: boolean
      status: string
      permLevel: string
      subscriptionTier: string
      phone: string
      startDate: string
      annualGoal: number
      totalProd: number
      totalPoliciesSold: number
      createdAt: string
      positionId: string
      positionName: string
      positionLevel: number
    }>('/user/profile')
    return data
  } catch {
    return null
  }
}

// Get user's downline (all agents below them in hierarchy)
export async function getUserDownline(userId: string) {
  try {
    const data = await apiCall<{
      agentId: string
      downlines: Array<{
        id: string
        name: string
        position: string
        positionLevel: number
        status: string
      }>
      downlineCount: number
    }>(`/agents/${userId}/downline`)
    return data.downlines || []
  } catch (error) {
    console.error('Error fetching downline:', error)
    return []
  }
}

// Get filtered data based on user permissions
export async function getVisibleAgents(currentUserId: string, isAdmin: boolean) {
  try {
    const view = isAdmin ? 'all' : 'downlines'
    const data = await apiCall<{
      agents: Array<{
        id: string
        email: string
        firstName: string
        lastName: string
        status: string
        role: string
        positionId: string
        positionName: string
        positionLevel: number
        createdAt: string
      }>
      total: number
    }>('/agents', { params: { view } })

    // Transform to match original format
    return (data.agents || []).map(agent => ({
      ...agent,
      position: agent.positionId ? {
        id: agent.positionId,
        name: agent.positionName,
        level: agent.positionLevel,
      } : null,
    }))
  } catch (error) {
    console.error('Error fetching visible agents:', error)
    throw error
  }
}

// Get commission reports (admin only)
// Uses Django reports endpoint at /api/dashboard/reports/
export async function getCommissionReports() {
  try {
    const data = await apiCall<{
      reports: Array<{
        id: string
        reportType: string
        name: string
        status: string
        createdAt: string
        completedAt: string | null
        params: Record<string, unknown>
      }>
    }>('/dashboard/reports/', { params: { report_type: 'commission' } })
    return data?.reports || []
  } catch (error) {
    console.error('Error fetching commission reports:', error)
    return []
  }
}

// Get positions
export async function getPositions(agencyId?: string) {
  try {
    const data = await apiCall<Array<{
      id: string
      name: string
      level: number
      description: string
      isActive: boolean
      createdAt: string
      agentCount: number
    }>>('/positions/', { params: agencyId ? { agency_id: agencyId } : {} })
    return data || []
  } catch (error) {
    console.error('Error fetching positions:', error)
    throw error
  }
}

// Get carriers
export async function getCarriers() {
  try {
    const data = await apiCall<{
      carriers: Array<{
        id: string
        name: string
        isActive: boolean
      }>
    }>('/carriers/')
    return data.carriers || []
  } catch (error) {
    console.error('Error fetching carriers:', error)
    throw error
  }
}

// Get products for a carrier
export async function getProductsByCarrier(carrierId: string) {
  try {
    const data = await apiCall<{
      products: Array<{
        id: string
        name: string
        carrierId: string
        productCode: string
        isActive: boolean
      }>
    }>('/products/', { params: { carrier_id: carrierId } })
    return data.products || []
  } catch (error) {
    console.error('Error fetching products:', error)
    throw error
  }
}

// Get commission structures for a product
// Note: This uses position_product_commissions endpoint
export async function getCommissionStructures(carrierId: string, productId?: string) {
  try {
    const params: Record<string, string | undefined> = { carrier_id: carrierId }
    if (productId) {
      params.product_id = productId
    }
    const data = await apiCall<Array<{
      id: string
      positionId: string
      productId: string
      commissionPercentage: number
      position?: {
        id: string
        name: string
        level: number
      }
    }>>('/positions/product-commissions', { params })
    return data || []
  } catch (error) {
    console.error('Error fetching commission structures:', error)
    throw error
  }
}

// Create or update commission structure
export async function upsertCommissionStructure(structure: {
  carrier_id: string
  product_id: string
  position_id: string
  percentage: number
  commission_type?: string
  level?: number
}) {
  try {
    // Use the position commissions endpoint
    const data = await apiCall<{
      id: string
      positionId: string
      productId: string
      commissionPercentage: number
    }>('/positions/product-commissions/sync', {
      method: 'POST',
      body: {
        position_id: structure.position_id,
        product_id: structure.product_id,
        commission_percentage: structure.percentage,
      },
    })
    return [data]
  } catch (error) {
    console.error('Error upserting commission structure:', error)
    throw error
  }
}

// Create position
export async function createPosition(position: {
  name: string
  level: number
}) {
  try {
    const data = await apiCall<{
      position: {
        id: string
        name: string
        level: number
        description: string
        isActive: boolean
        createdAt: string
      }
    }>('/positions/', {
      method: 'POST',
      body: position,
    })
    return data.position
  } catch (error) {
    console.error('Error creating position:', error)
    throw error
  }
}

// Create product
export async function createProduct(product: {
  carrier_id: string
  name: string
  product_code?: string
}) {
  try {
    const data = await apiCall<{
      product: {
        id: string
        name: string
        carrierId: string
        productCode: string
        isActive: boolean
      }
    }>('/products/', {
      method: 'POST',
      body: product,
    })
    return data.product
  } catch (error) {
    console.error('Error creating product:', error)
    throw error
  }
}

// Update user unique carriers from NIPR analysis
export async function updateUserCarriers(userId: string, carriers: string[]) {
  try {
    const data = await apiCall<{
      success: boolean
      uniqueCarriers: string[]
    }>(`/user/${userId}/carriers`, {
      method: 'PATCH',
      body: { unique_carriers: carriers },
    })
    return [{ unique_carriers: data.uniqueCarriers }]
  } catch (error) {
    console.error('Error updating user carriers:', error)
    throw error
  }
}

// Update user unique carriers and states from NIPR analysis (atomic update)
// This function is used in server-side code with admin client
export async function updateUserNIPRData(
  _supabaseClient: unknown,  // Kept for backwards compatibility but not used
  userId: string,
  carriers: string[],
  states: string[]
) {
  // Use Django API endpoint for updating NIPR data
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const response = await fetch(`${apiUrl}/api/user/${userId}/nipr-data`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Cron-Secret': process.env.CRON_SECRET || '',
    },
    body: JSON.stringify({
      unique_carriers: carriers,
      licensed_states: states,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to update NIPR data')
  }

  const data = await response.json()
  return [{ unique_carriers: data.unique_carriers, licensed_states: data.licensed_states }]
}
