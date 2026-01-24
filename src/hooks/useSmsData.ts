/**
 * SMS Data Hook
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getSmsEndpoint } from '@/lib/api-config'
import { fetchApi } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-config'
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

// ============ Hooks ============

export function useConversationsList(
  filters: ConversationsFilters,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<ConversationsResponse, Error>({
    queryKey: queryKeys.conversationsList(filters.view || 'all', filters),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getSmsEndpoint('conversations'))
      if (filters.view) url.searchParams.set('view', filters.view)
      if (filters.searchQuery) url.searchParams.set('search', filters.searchQuery)
      if (filters.notificationFilter) url.searchParams.set('notification', filters.notificationFilter)
      if (filters.agent) url.searchParams.set('agent', filters.agent)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch conversations')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.fast,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}

export function useMessages(
  conversationId: string | undefined,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<MessagesResponse, Error>({
    queryKey: queryKeys.messages(conversationId || ''),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getSmsEndpoint('messages'))
      url.searchParams.set('conversation_id', conversationId!)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch messages')
    },
    enabled: !!conversationId && (options?.enabled !== false),
    staleTime: STALE_TIMES.realtime,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  })
}

export function useDraftsList(
  view?: string,
  options?: { enabled?: boolean }
) {
  const supabase = createClient()

  return useQuery<DraftsResponse, Error>({
    queryKey: queryKeys.draftsList(view),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No session')
      }

      const url = new URL(getSmsEndpoint('drafts'))
      if (view) url.searchParams.set('view', view)

      return fetchApi(url.toString(), session.access_token, 'Failed to fetch drafts')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.fast,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}
