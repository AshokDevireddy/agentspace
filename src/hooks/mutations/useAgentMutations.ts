/**
 * Agent-related mutation hooks for TanStack Query
 * Used by agents page and agent modals for managing agents
 *
 * All mutations go through BFF proxy routes which handle
 * snake_case/camelCase conversion and return camelCase JSON.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../queryKeys'
import { useInvalidation } from '../useInvalidation'

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text()
    let message = `Request failed with status ${response.status}`
    try {
      const err = JSON.parse(text)
      message = err.message || err.error || message
    } catch { /* use default */ }
    throw new Error(message)
  }
  const text = await response.text()
  return text ? JSON.parse(text) : (null as T)
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text()
    let message = `Request failed with status ${response.status}`
    try {
      const err = JSON.parse(text)
      message = err.message || err.error || message
    } catch { /* use default */ }
    throw new Error(message)
  }
  const text = await response.text()
  return text ? JSON.parse(text) : (null as T)
}

async function deleteJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })
  if (!response.ok) {
    const text = await response.text()
    let message = `Request failed with status ${response.status}`
    try {
      const err = JSON.parse(text)
      message = err.message || err.error || message
    } catch { /* use default */ }
    throw new Error(message)
  }
  const text = await response.text()
  return text ? JSON.parse(text) : (null as T)
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
      return postJson('/api/agents/assign-position', { agentId, positionId })
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
      return postJson<{ message: string }>('/api/agents/resend-invite', { agentId })
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
      return postJson('/api/agents/invite', input)
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
      const { agentId, ...body } = variables
      return putJson<Agent>(`/api/agents/${agentId}`, body)
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
    mutationFn: async ({ agentId }) => {
      return deleteJson<void>(`/api/agents/${agentId}`)
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

        await postJson('/api/agents/invite', {
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
        await putJson(`/api/agents/${agentId}`, editedData)
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
