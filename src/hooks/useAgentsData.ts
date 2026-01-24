/**
 * Agents Data Hook
 *
 * Unified hook for fetching agents data.
 * Switches between Django backend and Next.js API routes based on feature flag.
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { shouldUseDjangoAgents, shouldUseDjangoAgentsList, shouldUseDjangoAgentsDownlines, shouldUseDjangoAgentsWithoutPositions } from '@/lib/feature-flags'
import { getAgentEndpoint } from '@/lib/api-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

export interface Agent {
  id: string
  name: string
  position: string
  upline: string
  created: string
  lastLogin: string
  earnings: string
  downlines: number
  status: string
  badge: string
  position_id?: string | null
  position_name?: string | null
  position_level?: number | null
  email?: string | null
  first_name?: string
  last_name?: string
  // Debt and production metrics
  individual_debt: number
  individual_debt_count: number
  individual_production: number
  individual_production_count: number
  hierarchy_debt: number
  hierarchy_debt_count: number
  hierarchy_production: number
  hierarchy_production_count: number
  debt_to_production_ratio: number | null
}

export interface TreeNode {
  name: string
  attributes?: Record<string, string>
  children?: TreeNode[]
}

export interface PendingAgent {
  agent_id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string | null
  role: string
  upline_name: string | null
  created_at: string
  position_id?: string | null
  position_name?: string | null
  has_position?: boolean
}

export interface AgentsListResponse {
  agents?: Agent[]
  tree?: TreeNode
  pagination?: {
    currentPage: number
    totalPages: number
    totalCount: number
    limit: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  allAgents?: Array<{ id: string; name: string }>
}

export interface AgentsFilters extends Record<string, unknown> {
  inUpline?: string
  directUpline?: string
  inDownline?: string
  directDownline?: string
  agentName?: string
  status?: string
  position?: string
  startMonth?: string
  endMonth?: string
  view?: 'table' | 'tree' | 'pending-positions'
}

export interface AgentDownlinesResponse {
  agentId: string
  downlines: Array<{
    id: string
    name: string
    position: string | null
    position_level: number | null
    badge: string
    status: string
    created_at: string
    individual_debt: number
    individual_debt_count: number
    individual_production: number
    individual_production_count: number
    hierarchy_debt: number
    hierarchy_debt_count: number
    hierarchy_production: number
    hierarchy_production_count: number
    debt_to_production_ratio: number | null
  }>
  downlineCount: number
}

export interface PendingPositionsResponse {
  agents: PendingAgent[]
  count: number
}

// ============ Fetch Functions ============

async function fetchDjangoAgentsList(
  accessToken: string,
  params: {
    page?: number
    limit?: number
    view?: string
    filters: AgentsFilters
  }
): Promise<AgentsListResponse> {
  const url = new URL(getAgentEndpoint('list'))

  if (params.view === 'tree') {
    url.searchParams.set('view', 'tree')
  } else {
    url.searchParams.set('page', String(params.page || 1))
    url.searchParams.set('limit', String(params.limit || 20))
  }

  // Add filter parameters
  const { filters } = params
  if (filters.inUpline && filters.inUpline !== 'all') {
    url.searchParams.set('inUpline', filters.inUpline)
  }
  if (filters.directUpline && filters.directUpline !== 'all') {
    url.searchParams.set('directUpline', filters.directUpline === 'not_set' ? 'not_set' : filters.directUpline)
  }
  if (filters.inDownline && filters.inDownline !== 'all') {
    url.searchParams.set('inDownline', filters.inDownline)
  }
  if (filters.directDownline && filters.directDownline !== 'all') {
    url.searchParams.set('directDownline', filters.directDownline)
  }
  if (filters.agentName && filters.agentName !== 'all') {
    url.searchParams.set('agentName', filters.agentName)
  }
  if (filters.status && filters.status !== 'all') {
    url.searchParams.set('status', filters.status)
  }
  if (filters.position && filters.position !== 'all') {
    url.searchParams.set('positionId', filters.position === 'not_set' ? 'not_set' : filters.position)
  }
  if (filters.startMonth) {
    url.searchParams.set('startMonth', filters.startMonth)
  }
  if (filters.endMonth) {
    url.searchParams.set('endMonth', filters.endMonth)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch agents')
  }

  return response.json()
}

async function fetchDjangoAgentDownlines(
  accessToken: string,
  agentId: string
): Promise<AgentDownlinesResponse> {
  const url = new URL(getAgentEndpoint('downlines'))
  url.searchParams.set('agentId', agentId)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch agent downlines')
  }

  return response.json()
}

async function fetchDjangoAgentsWithoutPositions(
  accessToken: string,
  fetchAll: boolean = true
): Promise<PendingPositionsResponse> {
  const url = new URL(getAgentEndpoint('withoutPositions'))
  if (fetchAll) {
    url.searchParams.set('all', 'true')
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch agents without positions')
  }

  return response.json()
}

// ============ Hooks ============

/**
 * Hook for agents list data (table and tree views).
 * Supports both Django backend and Next.js API routes.
 */
export function useAgentsList(
  page: number,
  view: 'table' | 'tree',
  filters: AgentsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoAgentsList()

  return useQuery<AgentsListResponse, Error>({
    queryKey: queryKeys.agentsList(page, view, filters),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoAgentsList(session.access_token, {
          page,
          limit: 20,
          view,
          filters,
        })
      }

      // Next.js API route fallback (current behavior)
      const params = new URLSearchParams()
      if (view === 'table') {
        params.append('page', page.toString())
        params.append('limit', '20')
      } else if (view === 'tree') {
        params.append('view', 'tree')
      }

      // Add filter parameters
      if (filters.inUpline && filters.inUpline !== 'all') {
        params.append('inUpline', filters.inUpline)
      }
      if (filters.directUpline && filters.directUpline !== 'all') {
        params.append('directUpline', filters.directUpline === 'not_set' ? 'not_set' : filters.directUpline)
      }
      if (filters.inDownline && filters.inDownline !== 'all') {
        params.append('inDownline', filters.inDownline)
      }
      if (filters.directDownline && filters.directDownline !== 'all') {
        params.append('directDownline', filters.directDownline)
      }
      if (filters.agentName && filters.agentName !== 'all') {
        params.append('agentName', filters.agentName)
      }
      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status)
      }
      if (filters.position && filters.position !== 'all') {
        params.append('positionId', filters.position === 'not_set' ? 'not_set' : filters.position)
      }
      if (filters.startMonth) {
        params.append('startMonth', filters.startMonth)
      }
      if (filters.endMonth) {
        params.append('endMonth', filters.endMonth)
      }

      const response = await fetch(`/api/agents?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch agents')
      }

      return response.json()
    },
    enabled: (view === 'table' || view === 'tree') && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30 seconds
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook for agent downlines data.
 * Supports both Django backend and Next.js API routes.
 */
export function useAgentDownlines(
  agentId: string | null,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoAgentsDownlines()

  return useQuery<AgentDownlinesResponse, Error>({
    queryKey: queryKeys.agentDownlines(agentId || ''),
    queryFn: async () => {
      if (!agentId) {
        throw new Error('No agent ID provided')
      }

      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoAgentDownlines(session.access_token, agentId)
      }

      // Next.js API route fallback
      const response = await fetch(`/api/agents/downlines?agentId=${agentId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch agent downlines')
      }

      return response.json()
    },
    enabled: !!agentId && (options?.enabled !== false),
    staleTime: 60 * 1000, // 1 minute
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}

/**
 * Hook for agents without positions (pending positions view).
 * Supports both Django backend and Next.js API routes.
 */
export function useAgentsWithoutPositions(options?: { enabled?: boolean }) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoAgentsWithoutPositions()

  return useQuery<PendingPositionsResponse, Error>({
    queryKey: queryKeys.agentsPendingPositions(),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoAgentsWithoutPositions(session.access_token, true)
      }

      // Next.js API route fallback
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        throw new Error('No access token available')
      }

      const url = new URL('/api/agents/without-positions', window.location.origin)
      url.searchParams.set('all', 'true')

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch pending positions')
      }

      return response.json()
    },
    enabled: options?.enabled !== false,
    staleTime: 30 * 1000, // 30 seconds
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}
