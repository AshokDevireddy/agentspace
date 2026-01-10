/**
 * Centralized conversation-related mutations
 * Handles conversation creation, checking, and starting
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../queryKeys'

interface Deal {
  id: string
  agentId: string
  clientName: string
  clientPhone: string
  carrier: string
  product: string
  policyNumber: string
  status: string
  agent: string
}

interface CheckConversationResponse {
  exists: boolean
  conversationId?: string
}

interface CreateConversationResponse {
  conversationId: string
  created: boolean
}

interface StartConversationInput {
  dealId: string
  initialMessage?: string
}

interface StartConversationResponse {
  conversationId: string
  messageId?: string
}

/**
 * Hook for checking if a conversation exists for a deal
 */
export function useCheckConversation(options?: {
  onExists?: (conversationId: string) => void
  onNotExists?: () => void
  onError?: (error: Error) => void
}) {
  return useMutation<CheckConversationResponse, Error, string>({
    mutationFn: async (dealId) => {
      const response = await fetch('/api/sms/conversations/get-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dealId }),
      })

      if (!response.ok) {
        throw new Error('Failed to check conversation')
      }

      return response.json()
    },
    onSuccess: (data) => {
      if (data.exists && data.conversationId) {
        options?.onExists?.(data.conversationId)
      } else {
        options?.onNotExists?.()
      }
    },
    onError: options?.onError,
  })
}

/**
 * Hook for creating a new conversation
 */
export function useCreateConversation(options?: {
  onSuccess?: (conversationId: string) => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<CreateConversationResponse, Error, { dealId: string; agentId: string }>({
    mutationFn: async ({ dealId, agentId }) => {
      const response = await fetch('/api/sms/conversations/get-or-create', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dealId, agentId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create conversation')
      }

      return response.json()
    },
    onSuccess: (data) => {
      // Invalidate all conversation queries
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
      options?.onSuccess?.(data.conversationId)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for starting a conversation with an optional initial message
 * Used from policy details modal and other places
 */
export function useStartConversation(options?: {
  onSuccess?: (conversationId: string) => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<StartConversationResponse, Error, StartConversationInput>({
    mutationFn: async ({ dealId, initialMessage }) => {
      const response = await fetch('/api/conversations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dealId, initialMessage }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start conversation')
      }

      return response.json()
    },
    onSuccess: (data) => {
      // Invalidate all conversation queries
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
      options?.onSuccess?.(data.conversationId)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for getting or creating a conversation (atomic operation)
 * Uses PUT endpoint which internally handles upsert semantics
 * Returns existing conversation ID if exists, creates new one if not
 *
 * IMPORTANT: This replaces the previous TOCTOU-vulnerable pattern that
 * called POST (check) then PUT (create) separately. The PUT endpoint
 * uses getOrCreateConversation() which is atomic.
 */
export function useGetOrCreateConversation(options?: {
  onSuccess?: (conversationId: string, wasCreated: boolean) => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<CreateConversationResponse & { wasCreated: boolean }, Error, { dealId: string; agentId: string }>({
    mutationFn: async ({ dealId, agentId }) => {
      // Single atomic call - the PUT endpoint uses getOrCreateConversation
      // which handles the upsert pattern atomically
      const response = await fetch('/api/sms/conversations/get-or-create', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dealId, agentId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get or create conversation')
      }

      const data = await response.json()
      // The PUT endpoint returns conversationId - we treat it as potentially created
      // since we don't know if it existed before without the check
      return {
        conversationId: data.conversationId,
        created: true,
        wasCreated: true
      }
    },
    onSuccess: (data) => {
      // Always invalidate since we may have created a new conversation
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
      options?.onSuccess?.(data.conversationId, data.wasCreated)
    },
    onError: options?.onError,
  })
}
