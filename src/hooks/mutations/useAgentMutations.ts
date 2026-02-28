/**
 * Agent-related mutation hooks for TanStack Query
 * Used by agents page and agent modals for managing agents
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '@/lib/auth/token-store'
import { queryKeys } from '../queryKeys'
import { useInvalidation } from '../useInvalidation'

/**
 * Helper for BFF mutation requests (POST, PUT, DELETE)
 * Sends camelCase to BFF - the BFF route handles snake_case conversion for Django
 */
async function fetchBffMutation<T>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getAccessToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const init: RequestInit = {
    method,
    headers,
    credentials: 'include',
  }

  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  const response = await fetch(url, init)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.message || `API error: ${response.status}`)
  }

  const text = await response.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

// ============ Assign Position Mutation ============

interface AssignPositionInput {
  agentId: string
  positionId: string
}

/**
 * Assign a position to an agent
 */
export function useAssignPosition(options?: {
  onSuccess?: (data: unknown, variables: AssignPositionInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgentRelated } = useInvalidation()

  return useMutation<unknown, Error, AssignPositionInput>({
    mutationFn: async ({ agentId, positionId }) => {
      return fetchBffMutation('/api/agents/assign-position', 'POST', { agentId, positionId })
    },
    onSuccess: async (data, variables) => {
      await invalidateAgentRelated(variables.agentId)
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

// ============ Resend Invite Mutation ============

/**
 * Resend an invitation to an agent
 */
export function useResendInvite(options?: {
  onSuccess?: (data: { message: string }, agentId: string) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgentRelated } = useInvalidation()

  return useMutation<
    { message: string },
    Error,
    string // agentId
  >({
    mutationFn: async (agentId) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const token = getAccessToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/agents/resend-invite', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ agentId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend invitation')
      }

      return data as { message: string }
    },
    onSuccess: (data, agentId) => {
      invalidateAgentRelated(agentId).catch(err => {
        console.error('[useResendInvite] Failed to invalidate queries:', err)
      })
      options?.onSuccess?.(data, agentId)
    },
    onError: options?.onError,
  })
}

// ============ Send Invite to Pre-invite User Mutation ============

interface SendInviteInput {
  email: string
  firstName: string
  lastName: string
  phoneNumber?: string | null
  permissionLevel: string
  uplineAgentId?: string | null
  positionId?: string | null
  preInviteUserId?: string | null
}

/**
 * Send invite to a pre-invite user or invite a new agent
 * This is the canonical invite mutation used by both agents page and onboarding wizard
 */
export function useSendInvite(options?: {
  invalidateClients?: boolean
  onSuccess?: (data: unknown, variables: SendInviteInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgentRelated, invalidateClientRelated } = useInvalidation()

  return useMutation<unknown, Error, SendInviteInput>({
    mutationFn: async (input) => {
      return fetchBffMutation('/api/agents/invite', 'POST', input)
    },
    onSuccess: async (data, variables) => {
      await invalidateAgentRelated()

      if (options?.invalidateClients) {
        await invalidateClientRelated()
      }

      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

// ============ Update Agent Mutation ============

interface UpdateAgentInput {
  agentId: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  positionId?: string | null
}

interface Agent {
  id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  positionId?: string | null
}

/**
 * Update an agent's details
 */
export function useUpdateAgent() {
  const queryClient = useQueryClient()

  return useMutation<Agent, Error, UpdateAgentInput>({
    mutationFn: async (variables) => {
      return fetchBffMutation<Agent>(`/api/agents/${variables.agentId}`, 'PUT', variables)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.agents] })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.agentsPendingPositions()] })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.agentDetail(variables.agentId)] })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.agentDownlines(variables.agentId)] })
    },
  })
}

// ============ Delete Agent Mutation ============

/**
 * Delete/deactivate an agent
 */
export function useDeleteAgent() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { agentId: string }>({
    mutationFn: async (variables) => {
      return fetchBffMutation<void>(`/api/agents/${variables.agentId}`, 'DELETE')
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.agents] })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.agentsPendingPositions()] })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.agentDetail(variables.agentId)] })
    },
  })
}

// ============ Save Agent Mutation (Update or Invite) ============

interface SaveAgentInput {
  agentId: string
  agentName: string
  editedData: {
    email: string
    phoneNumber?: string
    role: string
    status: string
    uplineId?: string
  }
  positionId?: string | null
  shouldSendInvite: boolean
}

interface SaveAgentResponse {
  type: 'invite' | 'update'
}

/**
 * Save agent changes - handles both update and invite operations
 * Used by agent-details-modal for the edit flow
 */
export function useSaveAgent(options?: {
  onSuccess?: (data: SaveAgentResponse, variables: SaveAgentInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgentRelated } = useInvalidation()

  return useMutation<SaveAgentResponse, Error, SaveAgentInput>({
    mutationFn: async ({ agentId, agentName, editedData, positionId, shouldSendInvite }) => {
      if (shouldSendInvite) {
        const nameParts = agentName.split(' ')
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''
        const permissionLevel = editedData.role === 'admin' ? 'admin' : 'agent'

        await fetchBffMutation('/api/agents/invite', 'POST', {
          email: editedData.email,
          firstName,
          lastName,
          phoneNumber: editedData.phoneNumber || null,
          permissionLevel,
          uplineAgentId: editedData.uplineId && editedData.uplineId !== 'all' ? editedData.uplineId : null,
          positionId: positionId || null,
          preInviteUserId: agentId,
        })

        return { type: 'invite' as const }
      } else {
        await fetchBffMutation(`/api/agents/${agentId}`, 'PUT', editedData)
        return { type: 'update' as const }
      }
    },
    onSuccess: async (data, variables) => {
      await invalidateAgentRelated(variables.agentId)
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}
