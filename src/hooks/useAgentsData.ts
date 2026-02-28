/**
 * Agents Data Hook
 *
 * Calls BFF proxy routes (/api/agents, /api/agents/without-positions) which
 * forward to Django and apply camelcaseKeys transformation on the response.
 */
import { useQuery } from '@tanstack/react-query'
import { STALE_TIMES } from '@/lib/query-config'
import { getAccessToken } from '@/lib/auth/token-store'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

export interface Agent {
  id: string
  name: string
  email: string | null
  firstName: string | null
  lastName: string | null
  position: string | null
  positionId: string | null
  positionName: string | null
  positionLevel: number | null
  upline: string | null
  status: string
  badge: string
  created: string
  earnings: string
  downlines: number
  individualDebt: number
  individualDebtCount: number
  individualProduction: number
  individualProductionCount: number
  hierarchyDebt: number
  hierarchyDebtCount: number
  hierarchyProduction: number
  hierarchyProductionCount: number
  debtToProductionRatio: number | null
  lastLogin: string | null
}

export interface TreeNode {
  name: string
  attributes?: Record<string, string>
  children?: TreeNode[]
}

export interface PendingAgent {
  agentId: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string | null
  role: string
  uplineName: string | null
  createdAt: string
  positionId?: string | null
  positionName?: string | null
  hasPosition?: boolean
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
    positionLevel: number | null
    badge: string
    status: string
    createdAt: string
    individualDebt: number
    individualDebtCount: number
    individualProduction: number
    individualProductionCount: number
    hierarchyDebt: number
    hierarchyDebtCount: number
    hierarchyProduction: number
    hierarchyProductionCount: number
    debtToProductionRatio: number | null
  }>
  downlineCount: number
}

export interface PendingPositionsResponse {
  agents: PendingAgent[]
  count: number
}

// ============ Helpers ============

async function fetchBff<T>(url: string, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getAccessToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    signal,
    credentials: 'include',
    headers,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.message || `API error: ${response.status}`)
  }

  return response.json()
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, value)
    }
  }
  return searchParams.toString()
}

function buildAgentFilterParams(filters: AgentsFilters): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {}

  if (filters.inUpline && filters.inUpline !== 'all') {
    params.inUpline = filters.inUpline
  }
  if (filters.directUpline && filters.directUpline !== 'all') {
    params.directUpline = filters.directUpline === 'not_set' ? 'not_set' : filters.directUpline
  }
  if (filters.inDownline && filters.inDownline !== 'all') {
    params.inDownline = filters.inDownline
  }
  if (filters.directDownline && filters.directDownline !== 'all') {
    params.directDownline = filters.directDownline
  }
  if (filters.agentName && filters.agentName !== 'all') {
    params.agentName = filters.agentName
  }
  if (filters.status && filters.status !== 'all') {
    params.status = filters.status
  }
  if (filters.position && filters.position !== 'all') {
    params.positionId = filters.position === 'not_set' ? 'not_set' : filters.position
  }
  if (filters.startMonth) {
    params.startMonth = filters.startMonth
  }
  if (filters.endMonth) {
    params.endMonth = filters.endMonth
  }

  return params
}

// ============ Hooks ============

export function useAgentsList(
  page: number,
  view: 'table' | 'tree',
  filters: AgentsFilters,
  options?: { enabled?: boolean }
) {
  return useQuery<AgentsListResponse, Error>({
    queryKey: queryKeys.agentsList(page, view, filters),
    queryFn: async ({ signal }) => {
      const params: Record<string, string | undefined> = {
        ...buildAgentFilterParams(filters),
      }
      if (view === 'tree') {
        params.view = 'tree'
      } else {
        params.page = String(page)
        params.limit = '20'
      }

      const qs = buildQueryString(params)
      return fetchBff<AgentsListResponse>(`/api/agents${qs ? `?${qs}` : ''}`, signal)
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
  return useQuery<AgentDownlinesResponse, Error>({
    queryKey: queryKeys.agentDownlines(agentId || ''),
    queryFn: async ({ signal }) => {
      return fetchBff<AgentDownlinesResponse>(`/api/agents/downlines?agentId=${agentId!}`, signal)
    },
    enabled: !!agentId && (options?.enabled !== false),
    staleTime: STALE_TIMES.standard,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}

export function useAgentsWithoutPositions(options?: { enabled?: boolean }) {
  return useQuery<PendingPositionsResponse, Error>({
    queryKey: queryKeys.agentsPendingPositions(),
    queryFn: async ({ signal }) => {
      return fetchBff<PendingPositionsResponse>('/api/agents/without-positions?all=true', signal)
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.fast,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}
