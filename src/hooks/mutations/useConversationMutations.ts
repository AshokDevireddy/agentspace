/**
 * Centralized conversation-related mutations
 * Handles conversation creation, checking, and starting
 */

import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useInvalidation } from '../useInvalidation'

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
      return apiClient.post<CheckConversationResponse>('/api/sms/conversations/get-or-create/', { dealId })
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
  onSuccess?: (data: CreateConversationResponse, variables: { dealId: string; agentId: string }) => void
  onError?: (error: Error) => void
}) {
  const { invalidateConversationRelated } = useInvalidation()

  return useMutation<CreateConversationResponse, Error, { dealId: string; agentId: string }>({
    mutationFn: async ({ dealId, agentId }) => {
      return apiClient.put<CreateConversationResponse>('/api/sms/conversations/get-or-create/', { dealId, agentId })
    },
    onSuccess: async (data, variables) => {
      await invalidateConversationRelated()
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for starting a conversation with an optional initial message
 * Used from policy details modal and other places
 */
export function useStartConversation(options?: {
  onSuccess?: (data: StartConversationResponse, variables: StartConversationInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateConversationRelated } = useInvalidation()

  return useMutation<StartConversationResponse, Error, StartConversationInput>({
    mutationFn: async ({ dealId, initialMessage }) => {
      return apiClient.post<StartConversationResponse>('/api/conversations/start/', { dealId, initialMessage })
    },
    onSuccess: async (data, variables) => {
      await invalidateConversationRelated()
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for getting or creating a conversation (atomic operation)
 * Uses PUT endpoint which internally handles upsert semantics
 * Returns existing conversation ID if exists, creates new one if not
 */
export function useGetOrCreateConversation(options?: {
  onSuccess?: (data: CreateConversationResponse & { wasCreated: boolean }, variables: { dealId: string; agentId: string }) => void
  onError?: (error: Error) => void
}) {
  const { invalidateConversationRelated } = useInvalidation()

  return useMutation<CreateConversationResponse & { wasCreated: boolean }, Error, { dealId: string; agentId: string }>({
    mutationFn: async ({ dealId, agentId }) => {
      const data = await apiClient.put<CreateConversationResponse>('/api/sms/conversations/get-or-create/', { dealId, agentId })
      return {
        conversationId: data.conversationId,
        created: true,
        wasCreated: true,
      }
    },
    onSuccess: async (data, variables) => {
      await invalidateConversationRelated()
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}
