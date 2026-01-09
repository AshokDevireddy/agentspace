/**
 * Centralized SMS-related mutations
 * Handles message sending, draft approval/rejection, and notification resolution
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, QueryKeyType } from '../queryKeys'

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
  getInvalidateFilters?: () => { viewMode: string; searchQuery: string; notificationFilter: string }
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<SendMessageResponse, Error, SendMessageInput>({
    mutationFn: async ({ dealId, message }) => {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dealId, message }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate messages query if conversation ID provided
      if (options?.conversationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(options.conversationId) })
      }

      // Invalidate conversations list with current filters
      if (options?.getInvalidateFilters) {
        const { viewMode, searchQuery, notificationFilter } = options.getInvalidateFilters()
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversationsList(viewMode, { searchQuery, notificationFilter })
        })
      }

      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

/**
 * Hook for approving SMS drafts (single or bulk)
 */
export function useApproveDrafts(options?: {
  conversationId?: string
  viewMode?: string
  onSuccess?: (messageIds: string[]) => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<DraftActionResponse, Error, DraftActionInput>({
    mutationFn: async ({ messageIds }) => {
      const response = await fetch('/api/sms/drafts/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageIds }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to approve draft(s)')
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      // Invalidate messages query if conversation ID provided
      if (options?.conversationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(options.conversationId) })
      }

      // Invalidate drafts list
      if (options?.viewMode) {
        queryClient.invalidateQueries({ queryKey: queryKeys.draftsList(options.viewMode) })
      }

      options?.onSuccess?.(variables.messageIds)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for rejecting SMS drafts (single or bulk)
 */
export function useRejectDrafts(options?: {
  conversationId?: string
  viewMode?: string
  onSuccess?: (messageIds: string[]) => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<DraftActionResponse, Error, DraftActionInput>({
    mutationFn: async ({ messageIds }) => {
      const response = await fetch('/api/sms/drafts/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageIds }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reject draft(s)')
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      // Invalidate messages query if conversation ID provided
      if (options?.conversationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(options.conversationId) })
      }

      // Invalidate drafts list
      if (options?.viewMode) {
        queryClient.invalidateQueries({ queryKey: queryKeys.draftsList(options.viewMode) })
      }

      options?.onSuccess?.(variables.messageIds)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for editing SMS draft content
 */
export function useEditDraft(options?: {
  conversationId?: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<{ success: boolean }, Error, EditDraftInput>({
    mutationFn: async ({ messageId, body }) => {
      const response = await fetch('/api/sms/drafts/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageId, body }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update draft')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate messages query if conversation ID provided
      if (options?.conversationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(options.conversationId) })
      }

      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

/**
 * Hook for resolving deal notifications (removes yellow indicator)
 */
export function useResolveNotification(options?: {
  getInvalidateFilters?: () => { viewMode: string; searchQuery: string; notificationFilter: string }
  onSuccess?: (dealId: string) => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<ResolveNotificationResponse, Error, string>({
    mutationFn: async (dealId) => {
      const response = await fetch(`/api/deals/${dealId}/resolve-notification`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resolve notification')
      }

      return response.json()
    },
    onSuccess: (_, dealId) => {
      // Invalidate deal details query
      queryClient.invalidateQueries({ queryKey: queryKeys.dealDetail(dealId) })

      // Invalidate conversations list with current filters
      if (options?.getInvalidateFilters) {
        const { viewMode, searchQuery, notificationFilter } = options.getInvalidateFilters()
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversationsList(viewMode, { searchQuery, notificationFilter })
        })
      }

      options?.onSuccess?.(dealId)
    },
    onError: options?.onError,
  })
}
