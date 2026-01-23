/**
 * SMS Data Hook
 *
 * Unified hook for fetching SMS data (conversations, messages, drafts).
 * Switches between Django backend and Next.js API routes based on feature flag.
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { shouldUseDjangoSms } from '@/lib/feature-flags'
import { getDjangoSmsEndpoint } from '@/lib/api-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

export interface Conversation {
  id: string
  phone_number: string
  client_id: string | null
  client_name: string | null
  agent_id: string | null
  agent_name: string | null
  deal_id: string | null
  policy_number: string | null
  last_message_at: string | null
  unread_count: number
  is_archived: boolean
  status?: string
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  content: string
  direction: 'inbound' | 'outbound'
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'received'
  sent_by: string | null
  is_read: boolean
  created_at: string
}

export interface DraftMessage {
  id: string
  conversation_id: string | null
  agent_id: string | null
  agent_name: string | null
  content: string
  status: 'pending' | 'approved' | 'rejected'
  client_name: string | null
  phone_number: string | null
  rejection_reason: string | null
  created_at: string
}

export interface ConversationsFilters extends Record<string, unknown> {
  view?: string
  searchQuery?: string
  notificationFilter?: string
  agent?: string
}

export interface Pagination {
  currentPage: number
  totalPages: number
  totalCount: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface ConversationsResponse {
  conversations: Conversation[]
  pagination: Pagination
}

export interface MessagesResponse {
  messages: Message[]
}

export interface DraftsResponse {
  drafts: DraftMessage[]
  pagination: Pagination
}

// ============ Fetch Functions ============

async function fetchDjangoConversations(
  accessToken: string,
  filters: ConversationsFilters
): Promise<ConversationsResponse> {
  const url = new URL(getDjangoSmsEndpoint('conversations'))

  // Add filter parameters
  if (filters.view) url.searchParams.set('view', filters.view)
  if (filters.searchQuery) url.searchParams.set('search', filters.searchQuery)
  if (filters.notificationFilter) url.searchParams.set('notification', filters.notificationFilter)
  if (filters.agent) url.searchParams.set('agent', filters.agent)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch conversations')
  }

  return response.json()
}

async function fetchDjangoMessages(
  accessToken: string,
  conversationId: string
): Promise<MessagesResponse> {
  const url = new URL(getDjangoSmsEndpoint('messages'))
  url.searchParams.set('conversation_id', conversationId)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch messages')
  }

  return response.json()
}

async function fetchDjangoDrafts(
  accessToken: string,
  view?: string
): Promise<DraftsResponse> {
  const url = new URL(getDjangoSmsEndpoint('drafts'))
  if (view) url.searchParams.set('view', view)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to fetch drafts')
  }

  return response.json()
}

// ============ Hooks ============

/**
 * Hook for SMS conversations list.
 * Supports both Django backend and Next.js API routes.
 */
export function useConversationsList(
  filters: ConversationsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoSms()

  return useQuery<ConversationsResponse, Error>({
    queryKey: queryKeys.conversationsList(filters.view || 'all', filters),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoConversations(session.access_token, filters)
      }

      // Next.js API route fallback
      const params = new URLSearchParams()
      if (filters.view) params.append('view', filters.view)
      if (filters.searchQuery) params.append('search', filters.searchQuery)
      if (filters.notificationFilter) params.append('notification', filters.notificationFilter)
      if (filters.agent) params.append('agent', filters.agent)

      const response = await fetch(`/api/sms/conversations?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch conversations')
      }

      return response.json()
    },
    enabled: options?.enabled !== false,
    staleTime: 30 * 1000, // 30 seconds
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook for messages in a conversation.
 * Supports both Django backend and Next.js API routes.
 */
export function useMessages(
  conversationId: string | undefined,
  viewMode?: string,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoSms()

  return useQuery<MessagesResponse, Error>({
    queryKey: queryKeys.messages(conversationId || ''),
    queryFn: async () => {
      if (!conversationId) {
        throw new Error('No conversation ID provided')
      }

      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoMessages(session.access_token, conversationId)
      }

      // Next.js API route fallback
      const params = new URLSearchParams()
      params.append('conversationId', conversationId)
      if (viewMode) params.append('view', viewMode)

      const response = await fetch(`/api/sms/messages?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch messages')
      }

      return response.json()
    },
    enabled: !!conversationId && (options?.enabled !== false),
    staleTime: 10 * 1000, // 10 seconds (messages update frequently)
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}

/**
 * Hook for SMS drafts list.
 * Supports both Django backend and Next.js API routes.
 */
export function useDraftsList(
  view?: string,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()
  const useDjango = shouldUseDjangoSms()

  return useQuery<DraftsResponse, Error>({
    queryKey: queryKeys.draftsList(view),
    queryFn: async () => {
      if (useDjango) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No session')
        }
        return fetchDjangoDrafts(session.access_token, view)
      }

      // Next.js API route fallback
      const params = new URLSearchParams()
      if (view) params.append('view', view)

      const response = await fetch(`/api/sms/drafts?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch drafts')
      }

      return response.json()
    },
    enabled: options?.enabled !== false,
    staleTime: 30 * 1000, // 30 seconds
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}
