/**
 * Centralized conversation-related mutations
 * Handles conversation creation, checking, and starting
 */

import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useInvalidation } from '../useInvalidation'

// GET /api/sms/conversations/find/ → { found, conversation }
interface FindConversationResponse {
  found: boolean
  conversation?: { id: string } | null
}

// PUT /api/sms/conversations/get-or-create/ raw response
interface PutConversationApiResponse {
  success: boolean
  conversation?: { id: string } | null
}

// Normalised shape returned to callers
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
 * Hook for checking if a conversation exists for a deal.
 * Uses read-only GET /api/sms/conversations/find/ — no side effects.
 */
export function useCheckConversation(options?: {
  onExists?: (conversationId: string) => void
  onNotExists?: () => void
  onError?: (error: Error) => void
}) {
  return useMutation<FindConversationResponse, Error, string>({
    mutationFn: async (dealId) => {
      return apiClient.get<FindConversationResponse>('/api/sms/conversations/find/', {
        params: { deal_id: dealId },
      })
    },
    onSuccess: (data) => {
      if (data.found && data.conversation?.id) {
        options?.onExists?.(data.conversation.id)
      } else {
        options?.onNotExists?.()
      }
    },
    onError: options?.onError,
  })
}

/**
 * Hook for creating a new conversation (after user confirms).
 * Uses PUT /api/sms/conversations/get-or-create/ which creates + sends welcome message.
 * Handles 409 gracefully by navigating to the existing conversation.
 */
export function useCreateConversation(options?: {
  onSuccess?: (data: CreateConversationResponse, variables: { dealId: string; agentId?: string }) => void
  onError?: (error: Error) => void
}) {
  const { invalidateConversationRelated } = useInvalidation()

  return useMutation<CreateConversationResponse, Error, { dealId: string; agentId?: string }>({
    mutationFn: async ({ dealId, agentId }) => {
      try {
        const response = await apiClient.put<PutConversationApiResponse>(
          '/api/sms/conversations/get-or-create/',
          { dealId, agentId },
        )
        const conversationId = response.conversation?.id
        if (!conversationId) {
          throw new Error('No conversation ID in response')
        }
        return { conversationId, created: true }
      } catch (err: unknown) {
        // 409 = conversation already exists for this phone number on a different deal
        // Treat as success and navigate to the existing conversation
        if (err instanceof Error && 'status' in err && (err as unknown as { status: number }).status === 409) {
          const apiErr = err as unknown as { data?: { existing_conversation?: { id: string } } }
          const existingId = apiErr.data?.existing_conversation?.id
          if (existingId) {
            return { conversationId: existingId, created: false }
          }
        }
        throw err
      }
    },
    onSuccess: async (data, variables) => {
      await invalidateConversationRelated()
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for starting a conversation with an optional initial message.
 * Used from policy details modal and other places.
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
 * Hook for getting or creating a conversation (atomic operation).
 * Uses PUT which handles upsert semantics internally.
 */
export function useGetOrCreateConversation(options?: {
  onSuccess?: (data: CreateConversationResponse & { wasCreated: boolean }, variables: { dealId: string; agentId: string }) => void
  onError?: (error: Error) => void
}) {
  const { invalidateConversationRelated } = useInvalidation()

  return useMutation<CreateConversationResponse & { wasCreated: boolean }, Error, { dealId: string; agentId: string }>({
    mutationFn: async ({ dealId, agentId }) => {
      const response = await apiClient.put<PutConversationApiResponse>(
        '/api/sms/conversations/get-or-create/',
        { dealId, agentId },
      )
      const conversationId = response.conversation?.id
      if (!conversationId) {
        throw new Error('No conversation ID in response')
      }
      return { conversationId, created: true, wasCreated: true }
    },
    onSuccess: async (data, variables) => {
      await invalidateConversationRelated()
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}
