/**
 * Centralized SMS-related mutations
 * Handles message sending, draft approval/rejection, and notification resolution
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useInvalidation } from '../useInvalidation'

interface SendMessageInput {
  dealId: string
  message: string
}

interface SendMessageResponse {
  success: boolean
  messageId?: string
}

interface DraftActionInput {
  messageIds: string[]
}

interface DraftActionResponse {
  success: boolean
  processed: number
}

interface EditDraftInput {
  messageId: string
  body: string
}

interface ResolveNotificationResponse {
  success: boolean
}

/**
 * Hook for sending SMS messages
 */
export function useSendMessage(options?: {
  conversationId?: string
  onSuccess?: (data: SendMessageResponse, variables: SendMessageInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateConversationRelated } = useInvalidation()

  return useMutation<SendMessageResponse, Error, SendMessageInput>({
    mutationFn: async ({ dealId, message }) => {
      return apiClient.post<SendMessageResponse>('/api/sms/send/', { dealId, message })
    },
    onSuccess: async (data, variables) => {
      await invalidateConversationRelated(options?.conversationId)
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for approving SMS drafts (single or bulk)
 */
export function useApproveDrafts(options?: {
  conversationId?: string
  onSuccess?: (data: DraftActionResponse, variables: DraftActionInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateConversationRelated } = useInvalidation()

  return useMutation<DraftActionResponse, Error, DraftActionInput>({
    mutationFn: async ({ messageIds }) => {
      return apiClient.post<DraftActionResponse>('/api/sms/drafts/approve/', { messageIds })
    },
    onSuccess: async (data, variables) => {
      await invalidateConversationRelated(options?.conversationId)
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for rejecting SMS drafts (single or bulk)
 */
export function useRejectDrafts(options?: {
  conversationId?: string
  onSuccess?: (data: DraftActionResponse, variables: DraftActionInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateConversationRelated } = useInvalidation()

  return useMutation<DraftActionResponse, Error, DraftActionInput>({
    mutationFn: async ({ messageIds }) => {
      return apiClient.post<DraftActionResponse>('/api/sms/drafts/reject/', { messageIds })
    },
    onSuccess: async (data, variables) => {
      await invalidateConversationRelated(options?.conversationId)
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for editing SMS draft content
 */
export function useEditDraft(options?: {
  conversationId?: string
  onSuccess?: (data: { success: boolean }, variables: EditDraftInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateConversationRelated } = useInvalidation()

  return useMutation<{ success: boolean }, Error, EditDraftInput>({
    mutationFn: async ({ messageId, body }) => {
      return apiClient.post<{ success: boolean }>('/api/sms/drafts/edit/', { messageId, body })
    },
    onSuccess: async (data, variables) => {
      await invalidateConversationRelated(options?.conversationId)
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for resolving deal notifications (removes yellow indicator)
 */
export function useResolveNotification(options?: {
  onSuccess?: (data: ResolveNotificationResponse, dealId: string) => void
  onError?: (error: Error) => void
}) {
  const { invalidateDealRelated, invalidateConversationRelated } = useInvalidation()

  return useMutation<ResolveNotificationResponse, Error, string>({
    mutationFn: async (dealId) => {
      return apiClient.post<ResolveNotificationResponse>(`/api/deals/${dealId}/resolve-notification/`)
    },
    onSuccess: async (data, dealId) => {
      await Promise.all([
        invalidateDealRelated(dealId),
        invalidateConversationRelated(),
      ])
      options?.onSuccess?.(data, dealId)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for retrying failed SMS messages
 */
export function useRetryFailed(options?: { onSuccess?: () => void; onError?: (error: Error) => void }) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (messageIds: string[]) => {
      return apiClient.post('/api/sms/failed/retry/', { messageIds })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      options?.onSuccess?.()
    },
    onError: (error: Error) => {
      options?.onError?.(error)
    },
  })
}
