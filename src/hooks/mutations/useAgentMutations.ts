/**
 * Agent-related mutation hooks for TanStack Query
 * Used by agents page and agent modals for managing agents
 *
 * Mirrors main branch patterns:
 * - useAssignPosition: Authorization header + snake_case body (main uses Supabase getSession)
 * - useResendInvite: credentials: 'include' only (cookie-based auth)
 * - useSendInvite: credentials: 'include' only (cookie-based auth)
 * - useUpdateAgent: useApiMutation with credentials: 'include'
 * - useDeleteAgent: useApiMutation with credentials: 'include'
 * - useSaveAgent: credentials: 'include' only (cookie-based auth)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '@/lib/auth/token-store'
import { queryKeys } from '../queryKeys'
import { useInvalidation } from '../useInvalidation'

// ============ Assign Position Mutation ============

interface AssignPositionInput {
  agentId: string
  positionId: string
}

/**
 * Assign a position to an agent
 * Main branch pattern: gets Supabase session token → sends Authorization header
 * This branch: gets Django token from memory store → sends Authorization header
 */
export function useAssignPosition(options?: {
  onSuccess?: (data: unknown, variables: AssignPositionInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgentRelated } = useInvalidation()

  return useMutation<unknown, Error, AssignPositionInput>({
    mutationFn: async ({ agentId, positionId }) => {
      const accessToken = getAccessToken()

      if (!accessToken) {
        throw new Error('Authentication required. Please log in.')
      }

      const response = await fetch('/api/agents/assign-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          agent_id: agentId,
          position_id: positionId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to assign position')
      }

      return response.json()
    },
    onSuccess: (data, variables) => {
      invalidateAgentRelated(variables.agentId).catch(err => {
        console.error('[useAssignPosition] Failed to invalidate queries:', err)
      })
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

// ============ Resend Invite Mutation ============

/**
 * Resend an invitation to an agent
 * Main branch pattern: credentials: 'include' only (cookie-based auth)
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
      const response = await fetch('/api/agents/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ agentId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend invitation')
      }

      return data
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
 * Main branch pattern: credentials: 'include' only (cookie-based auth)
 */
export function useSendInvite(options?: {
  invalidateClients?: boolean
  onSuccess?: (data: unknown, variables: SendInviteInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgentRelated, invalidateClientRelated } = useInvalidation()

  return useMutation<unknown, Error, SendInviteInput>({
    mutationFn: async (input) => {
      const response = await fetch('/api/agents/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send invitation')
      }

      return response.json()
    },
    onSuccess: (data, variables) => {
      invalidateAgentRelated().catch(err => {
        console.error('[useSendInvite] Failed to invalidate agent queries:', err)
      })

      if (options?.invalidateClients) {
        invalidateClientRelated().catch(err => {
          console.error('[useSendInvite] Failed to invalidate client queries:', err)
        })
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
 * Main branch pattern: useAuthenticatedMutation (Authorization header + credentials: 'include')
 */
export function useUpdateAgent() {
  const queryClient = useQueryClient()

  return useMutation<Agent, Error, UpdateAgentInput>({
    mutationFn: async (variables) => {
      const accessToken = getAccessToken()
      if (!accessToken) {
        throw new Error('Authentication required. Please log in.')
      }

      const response = await fetch(`/api/agents/${variables.agentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify(variables),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.detail || 'Failed to update agent')
      }

      const text = await response.text()
      if (!text) return null as unknown as Agent
      return JSON.parse(text) as Agent
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
 * Main branch pattern: useAuthenticatedMutation (Authorization header + credentials: 'include')
 */
export function useDeleteAgent() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { agentId: string }>({
    mutationFn: async (variables) => {
      const accessToken = getAccessToken()
      if (!accessToken) {
        throw new Error('Authentication required. Please log in.')
      }

      const response = await fetch(`/api/agents/${variables.agentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete agent')
      }
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
    phone_number?: string
    role: string
    status: string
    upline_id?: string
  }
  positionId?: string | null
  shouldSendInvite: boolean
}

interface SaveAgentResponse {
  type: 'invite' | 'update'
}

/**
 * Save agent changes - handles both update and invite operations
 * Main branch pattern: credentials: 'include' only (cookie-based auth)
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

        const inviteResponse = await fetch('/api/agents/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: editedData.email,
            firstName,
            lastName,
            phoneNumber: editedData.phone_number || null,
            permissionLevel,
            uplineAgentId: editedData.upline_id && editedData.upline_id !== 'all' ? editedData.upline_id : null,
            positionId: positionId || null,
            preInviteUserId: agentId,
          }),
        })

        if (!inviteResponse.ok) {
          const errorData = await inviteResponse.json()
          throw new Error(errorData.error || 'Failed to send invitation')
        }

        return { type: 'invite' as const }
      } else {
        const response = await fetch(`/api/agents/${agentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(editedData),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || errorData.detail || 'Failed to update agent')
        }

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
