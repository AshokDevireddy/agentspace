/**
 * Agent-related mutation hooks for TanStack Query
 * Used by agents page and agent modals for managing agents
 */

import { useMutation } from '@tanstack/react-query'
import { useAuthenticatedMutation } from '../useMutations'
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
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

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
      // Use centralized invalidation - handles agents, positions, and agent details (fire and forget)
      // Don't await to prevent blocking the UI update
      invalidateAgentRelated(variables.agentId).catch(err => {
        console.error('[useAssignPosition] Failed to invalidate queries:', err)
      })
      // Call the page-level success handler immediately
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
      // Invalidate agent-related queries to refresh status (fire and forget)
      // Don't await to prevent blocking the UI update
      invalidateAgentRelated(agentId).catch(err => {
        console.error('[useResendInvite] Failed to invalidate queries:', err)
      })
      // Call the page-level success handler immediately
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
  preInviteUserId?: string | null  // Optional for onboarding flow
}

/**
 * Send invite to a pre-invite user or invite a new agent
 * This is the canonical invite mutation used by both agents page and onboarding wizard
 */
export function useSendInvite(options?: {
  invalidateClients?: boolean  // Also invalidate clients
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
      // Use centralized invalidation - handles agents and positions (fire and forget)
      // Don't await to prevent blocking the UI update
      invalidateAgentRelated().catch(err => {
        console.error('[useSendInvite] Failed to invalidate agent queries:', err)
      })

      // Optionally invalidate client queries (also fire and forget)
      if (options?.invalidateClients) {
        invalidateClientRelated().catch(err => {
          console.error('[useSendInvite] Failed to invalidate client queries:', err)
        })
      }

      // Call the page-level success handler immediately
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

// ============ Update Agent Mutation ============

interface UpdateAgentInput {
  agentId: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  position_id?: string | null
}

interface Agent {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  position_id?: string | null
}

/**
 * Update an agent's details
 */
export function useUpdateAgent() {
  return useAuthenticatedMutation<Agent, UpdateAgentInput>(
    (variables) => `/api/agents/${variables.agentId}`,
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
  return useAuthenticatedMutation<void, { agentId: string }>(
    (variables) => `/api/agents/${variables.agentId}`,
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
        // Send invite using the invite API
        const nameParts = agentName.split(' ')
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''

        // Determine permission level from role
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
        // Regular save (without invite)
        const response = await fetch(`/api/agents/${agentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(editedData),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to update agent')
        }

        return { type: 'update' as const }
      }
    },
    onSuccess: async (data, variables) => {
      // Use centralized invalidation - handles agents, positions, and agent details
      await invalidateAgentRelated(variables.agentId)
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}
