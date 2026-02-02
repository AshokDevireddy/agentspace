/**
 * SMS Data Hook
 *
 * Migrated to use cookie-based auth via fetchWithCredentials.
 * BFF routes handle auth via httpOnly cookies - no need for manual token passing.
 */
import { useQuery } from '@tanstack/react-query'
import { getSmsEndpoint } from '@/lib/api-config'
import { fetchWithCredentials } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-config'
import { queryKeys } from './queryKeys'
import { shouldRetry, getRetryDelay } from './useQueryRetry'

// ============ Types ============

export interface Conversation {
  id: string
  agency_id: string
  agent_id: string | null
  agent_name: string | null
  deal_id: string | null
  client_phone: string | null
  type: 'sms'
  is_active: boolean
  last_message_at: string | null
  created_at: string
  sms_opt_in_status: 'opted_in' | 'opted_out' | 'pending' | null
  opted_in_at: string | null
  opted_out_at: string | null
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  sender_name: string | null
  receiver_id: string | null
  body: string
  direction: 'inbound' | 'outbound'
  message_type: 'sms'
  sent_at: string | null
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'received'
  metadata: Record<string, unknown>
  read_at: string | null
  is_read: boolean
}

export interface DraftMessage {
  id: string
  agency_id: string
  conversation_id: string | null
  agent_id: string | null
  agent_name: string | null
  content: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by_id: string | null
  approved_by_name: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
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
  return useQuery<ConversationsResponse, Error>({
    queryKey: queryKeys.conversationsList(filters.view || 'all', filters),
    queryFn: async () => {
      const url = new URL(getSmsEndpoint('conversations'))
      if (filters.view) url.searchParams.set('view', filters.view)
      if (filters.searchQuery) url.searchParams.set('search', filters.searchQuery)
      if (filters.notificationFilter) url.searchParams.set('notification', filters.notificationFilter)
      if (filters.agent) url.searchParams.set('agent', filters.agent)

      return fetchWithCredentials(url.toString(), 'Failed to fetch conversations')
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
  return useQuery<MessagesResponse, Error>({
    queryKey: queryKeys.messages(conversationId || ''),
    queryFn: async () => {
      const url = new URL(getSmsEndpoint('messages'))
      url.searchParams.set('conversation_id', conversationId!)

      return fetchWithCredentials(url.toString(), 'Failed to fetch messages')
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
  return useQuery<DraftsResponse, Error>({
    queryKey: queryKeys.draftsList(view),
    queryFn: async () => {
      const url = new URL(getSmsEndpoint('drafts'))
      if (view) url.searchParams.set('view', view)

      return fetchWithCredentials(url.toString(), 'Failed to fetch drafts')
    },
    enabled: options?.enabled !== false,
    staleTime: STALE_TIMES.fast,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
    placeholderData: (previousData) => previousData,
  })
}
