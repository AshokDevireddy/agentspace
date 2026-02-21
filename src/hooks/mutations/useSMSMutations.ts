/**
 * Centralized SMS-related mutations
 * Handles message sending, draft approval/rejection, and notification resolution
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
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
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dealId, message }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || 'Failed to send message')
      }

      return response.json()
    },
    onSuccess: async (data, variables) => {
      // Use centralized invalidation with predicate-based conversation list invalidation
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
      const response = await fetch('/api/sms/drafts/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageIds }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || 'Failed to approve draft(s)')
      }

      return response.json()
    },
    onSuccess: async (data, variables) => {
      // Use centralized invalidation - handles conversations, drafts, and messages
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
      const response = await fetch('/api/sms/drafts/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageIds }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || 'Failed to reject draft(s)')
      }

      return response.json()
    },
    onSuccess: async (data, variables) => {
      // Use centralized invalidation - handles conversations, drafts, and messages
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
      const response = await fetch('/api/sms/drafts/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageId, body }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || 'Failed to update draft')
      }

      return response.json()
    },
    onSuccess: async (data, variables) => {
      // Use centralized invalidation - handles conversations, drafts, and messages
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
      const response = await fetch(`/api/deals/${dealId}/resolve-notification`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || 'Failed to resolve notification')
      }

      return response.json()
    },
    onSuccess: async (data, dealId) => {
      // Use centralized invalidation - handles deal details and all conversation lists
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
      const response = await fetch('/api/sms/failed/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message_ids: messageIds }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to retry messages')
      }

      return response.json()
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
