/**
 * Agents Data Hook
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getAgentEndpoint } from '@/lib/api-config'
import { fetchApi } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

export interface Agent {
  id: string
  name: string
  email: string | null
  first_name: string | null
  last_name: string | null
  position: string | null
  position_id: string | null
  position_name: string | null
  position_level: number | null
  upline: string | null
  status: string
  badge: string
  created: string
  earnings: string
  downlines: number
  individual_debt: string
  individual_debt_count: number
  individual_production: string
  individual_production_count: number
  hierarchy_debt: string
  hierarchy_debt_count: number
  hierarchy_production: string
  hierarchy_production_count: number
  debt_to_production_ratio: string | null
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

// ============ Helpers ============

function buildAgentFilterParams(filters: AgentsFilters, params: URLSearchParams): void {
  if (filters.inUpline && filters.inUpline !== 'all') {
    params.set('inUpline', filters.inUpline)
  }
  if (filters.directUpline && filters.directUpline !== 'all') {
    params.set('directUpline', filters.directUpline === 'not_set' ? 'not_set' : filters.directUpline)
  }
  if (filters.inDownline && filters.inDownline !== 'all') {
    params.set('inDownline', filters.inDownline)
  }
  if (filters.directDownline && filters.directDownline !== 'all') {
    params.set('directDownline', filters.directDownline)
  }
  if (filters.agentName && filters.agentName !== 'all') {
    params.set('agentName', filters.agentName)
  }
  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status)
  }
  if (filters.position && filters.position !== 'all') {
    params.set('positionId', filters.position === 'not_set' ? 'not_set' : filters.position)
  }
  if (filters.startMonth) {
    params.set('startMonth', filters.startMonth)
  }
  if (filters.endMonth) {
    params.set('endMonth', filters.endMonth)
  }
}

// ============ Hooks ============

export function useAgentsList(
  page: number,
  view: 'table' | 'tree',
  filters: AgentsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<AgentsListResponse, Error>({
    queryKey: queryKeys.agentsList(page, view, filters),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getAgentEndpoint('list'))
      if (view === 'tree') {
        url.searchParams.set('view', 'tree')
      } else {
        url.searchParams.set('page', String(page))
        url.searchParams.set('limit', '20')
      }
      buildAgentFilterParams(filters, url.searchParams)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch agents')
    },
    enabled: (view === 'table' || view === 'tree') && (options?.enabled !== false),
    staleTime: STALE_TIMES.fast,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

export function useAgentDownlines(
  agentId: string | null,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<AgentDownlinesResponse, Error>({
    queryKey: queryKeys.agentDownlines(agentId || ''),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getAgentEndpoint('downlines'))
      url.searchParams.set('agentId', agentId!)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch agent downlines')
    },
    enabled: !!agentId && (options?.enabled !== false),
    staleTime: STALE_TIMES.standard,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}

export function useAgentsWithoutPositions(options?: { enabled?: boolean }) {
  const supabase = createClient()

  return useQuery<PendingPositionsResponse, Error>({
    queryKey: queryKeys.agentsPendingPositions(),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getAgentEndpoint('withoutPositions'))
      url.searchParams.set('all', 'true')

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch agents without positions')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.fast,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}
