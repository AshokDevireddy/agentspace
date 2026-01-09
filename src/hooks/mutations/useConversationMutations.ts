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
 * Hook for getting or creating a conversation (combined operation)
 * Returns existing conversation ID if exists, creates new one if not
 */
export function useGetOrCreateConversation(options?: {
  onSuccess?: (conversationId: string, wasCreated: boolean) => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<CreateConversationResponse & { wasCreated: boolean }, Error, { dealId: string; agentId: string }>({
    mutationFn: async ({ dealId, agentId }) => {
      // First check if exists
      const checkResponse = await fetch('/api/sms/conversations/get-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dealId }),
      })

      if (!checkResponse.ok) {
        throw new Error('Failed to check conversation')
      }

      const checkData = await checkResponse.json()

      if (checkData.exists) {
        return { conversationId: checkData.conversationId, created: false, wasCreated: false }
      }

      // Create new conversation
      const createResponse = await fetch('/api/sms/conversations/get-or-create', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dealId, agentId }),
      })

      if (!createResponse.ok) {
        const error = await createResponse.json()
        throw new Error(error.error || 'Failed to create conversation')
      }

      const createData = await createResponse.json()
      return { ...createData, wasCreated: true }
    },
    onSuccess: (data) => {
      if (data.wasCreated) {
        // Invalidate all conversation queries only if we created a new one
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
      }
      options?.onSuccess?.(data.conversationId, data.wasCreated)
    },
    onError: options?.onError,
  })
}
