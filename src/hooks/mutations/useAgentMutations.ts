/**
 * Agent-related mutation hooks for TanStack Query
 * Used by agents page and agent modals for managing agents
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthenticatedMutation } from '../useMutations'
import { queryKeys } from '../queryKeys'

// ============ Assign Position Mutation ============

interface AssignPositionInput {
  agentId: string
  positionId: string
}

/**
 * Assign a position to an agent
 */
export function useAssignPosition() {
  const queryClient = useQueryClient()

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
    onSuccess: (_data, variables) => {
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: queryKeys.agentsPendingPositions() })
      queryClient.invalidateQueries({ queryKey: queryKeys.agents })
      // Invalidate detail query for the specific agent (fixes modal showing stale data)
      queryClient.invalidateQueries({ queryKey: queryKeys.agentDetail(variables.agentId) })
    },
  })
}

// ============ Resend Invite Mutation ============

/**
 * Resend an invitation to an agent
 */
export function useResendInvite() {
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
  preInviteUserId: string
}

/**
 * Send invite to a pre-invite user
 */
export function useSendInvite() {
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
