/**
 * Agent-related mutation hooks for TanStack Query
 * Used by agents page and agent modals for managing agents
 */

import { useMutation } from '@tanstack/react-query'
import { useApiMutation } from '../useMutations'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '../queryKeys'
import { useInvalidation } from '../useInvalidation'

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
      return apiClient.post('/api/agents/assign-position/', { agentId, positionId })
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
      return apiClient.post<{ message: string }>('/api/agents/resend-invite/', { agentId })
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
      return apiClient.post('/api/agents/invite/', input)
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
  return useApiMutation<Agent, UpdateAgentInput>(
    (variables) => `/api/agents/${variables.agentId}/`,
    {
      method: 'PUT',
      invalidateKeys: [queryKeys.agents, queryKeys.agentsPendingPositions()],
      getInvalidateKeys: (variables) => [
        queryKeys.agentDetail(variables.agentId),
        queryKeys.agentDownlines(variables.agentId),
      ],
    }
  )
}

// ============ Delete Agent Mutation ============

/**
 * Delete/deactivate an agent
 */
export function useDeleteAgent() {
  return useApiMutation<void, { agentId: string }>(
    (variables) => `/api/agents/${variables.agentId}/`,
    {
      method: 'DELETE',
      invalidateKeys: [queryKeys.agents, queryKeys.agentsPendingPositions()],
      getInvalidateKeys: (variables) => [
        queryKeys.agentDetail(variables.agentId),
      ],
    }
  )
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

        await apiClient.post('/api/agents/invite/', {
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
        await apiClient.put(`/api/agents/${agentId}/`, editedData)
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
