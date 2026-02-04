/**
 * Server-Sent Events (SSE) Hook
 *
 * A reusable hook for connecting to SSE endpoints and handling events.
 * Replaces Supabase realtime subscriptions with Django SSE.
 */

import { useEffect, useRef, useCallback } from 'react'
import { getClientAccessToken } from '@/lib/auth/client'

interface SSEOptions {
  /** Whether the SSE connection is enabled */
  enabled?: boolean
  /** Event handlers for different event types */
  onEvent?: (eventType: string, data: any) => void
  /** Callback when connection is established */
  onOpen?: () => void
  /** Callback when connection errors occur */
  onError?: (error: Event) => void
  /** Callback when connection closes */
  onClose?: () => void
  /** Whether to auto-reconnect on error (default: true) */
  autoReconnect?: boolean
  /** Delay before reconnecting in ms (default: 3000) */
  reconnectDelay?: number
  /** Maximum reconnection attempts (default: 5) */
  maxReconnectAttempts?: number
}

interface SSEState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  reconnectAttempts: number
}

/**
 * Hook for connecting to Server-Sent Events endpoints
 *
 * @param url - The SSE endpoint URL (relative to API base)
 * @param options - Connection options and event handlers
 * @returns Connection state and control methods
 */
export function useSSE(
  url: string,
  options: SSEOptions = {}
) {
  const {
    enabled = true,
    onEvent,
    onOpen,
    onError,
    onClose,
    autoReconnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
  } = options

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const mountedRef = useRef(true)

  // Track if we should be connected
  const shouldConnectRef = useRef(enabled)
  shouldConnectRef.current = enabled

  // Store callbacks in refs to avoid re-subscriptions
  const onEventRef = useRef(onEvent)
  const onOpenRef = useRef(onOpen)
  const onErrorRef = useRef(onError)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onEventRef.current = onEvent
    onOpenRef.current = onOpen
    onErrorRef.current = onError
    onCloseRef.current = onClose
  }, [onEvent, onOpen, onError, onClose])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const connect = useCallback(async () => {
    // Don't connect if not enabled or already connected
    if (!shouldConnectRef.current || eventSourceRef.current) {
      return
    }

    try {
      // Get access token for authenticated SSE
      const accessToken = await getClientAccessToken()
      if (!accessToken) {
        console.error('[SSE] No access token available')
        return
      }

      // Construct full URL with auth token as query param
      // (EventSource doesn't support custom headers)
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ''
      const separator = url.includes('?') ? '&' : '?'
      const fullUrl = `${baseUrl}${url}${separator}token=${accessToken}`

      const eventSource = new EventSource(fullUrl)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        if (!mountedRef.current) return
        reconnectAttemptsRef.current = 0
        onOpenRef.current?.()
      }

      eventSource.onerror = (event) => {
        if (!mountedRef.current) return
        onErrorRef.current?.(event)

        // Handle reconnection
        if (autoReconnect && shouldConnectRef.current) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++
            disconnect()

            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current && shouldConnectRef.current) {
                connect()
              }
            }, reconnectDelay)
          } else {
            console.error('[SSE] Max reconnection attempts reached')
            disconnect()
          }
        }
      }

      // Handle generic message event
      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return
        try {
          const data = JSON.parse(event.data)
          onEventRef.current?.('message', data)
        } catch {
          console.error('[SSE] Failed to parse message:', event.data)
        }
      }

      // Handle specific named events
      const handleNamedEvent = (eventType: string) => (event: MessageEvent) => {
        if (!mountedRef.current) return
        try {
          const data = JSON.parse(event.data)
          onEventRef.current?.(eventType, data)
        } catch {
          console.error(`[SSE] Failed to parse ${eventType} event:`, event.data)
        }
      }

      // Register common event types
      const eventTypes = [
        'new_message',
        'message_updated',
        'conversation_updated',
        'count_update',
        'conversation_update',
        'error',
        'timeout',
      ]

      for (const eventType of eventTypes) {
        eventSource.addEventListener(eventType, handleNamedEvent(eventType))
      }
    } catch (error) {
      console.error('[SSE] Connection error:', error)
    }
  }, [url, autoReconnect, reconnectDelay, maxReconnectAttempts, disconnect])

  // Connect/disconnect based on enabled state
  useEffect(() => {
    mountedRef.current = true

    if (enabled) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      mountedRef.current = false
      disconnect()
    }
  }, [enabled, connect, disconnect])

  // Reconnect when URL changes
  useEffect(() => {
    if (enabled && eventSourceRef.current) {
      disconnect()
      connect()
    }
  }, [url])

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    disconnect()
    connect()
  }, [disconnect, connect])

  return {
    disconnect,
    reconnect,
    isConnected: !!eventSourceRef.current,
  }
}

/**
 * Hook specifically for conversation messages SSE
 */
export function useConversationMessagesSSE(
  conversationId: string | null,
  options: {
    onNewMessage?: (message: any) => void
    onMessageUpdated?: (message: any) => void
    onConversationUpdated?: (conversation: any) => void
    enabled?: boolean
  } = {}
) {
  const {
    onNewMessage,
    onMessageUpdated,
    onConversationUpdated,
    enabled = true,
  } = options

  const handleEvent = useCallback((eventType: string, data: any) => {
    switch (eventType) {
      case 'new_message':
        onNewMessage?.(data)
        break
      case 'message_updated':
        onMessageUpdated?.(data)
        break
      case 'conversation_updated':
        onConversationUpdated?.(data)
        break
      case 'timeout':
        console.log('[SSE] Connection timeout, will reconnect')
        break
      case 'error':
        console.error('[SSE] Server error:', data)
        break
    }
  }, [onNewMessage, onMessageUpdated, onConversationUpdated])

  const url = conversationId
    ? `/api/sms/sse/messages?conversation_id=${conversationId}`
    : ''

  return useSSE(url, {
    enabled: enabled && !!conversationId,
    onEvent: handleEvent,
  })
}

/**
 * Hook specifically for unread count SSE
 */
export function useUnreadCountSSE(
  options: {
    onCountUpdate?: (count: number) => void
    enabled?: boolean
  } = {}
) {
  const { onCountUpdate, enabled = true } = options

  const handleEvent = useCallback((eventType: string, data: any) => {
    if (eventType === 'count_update') {
      onCountUpdate?.(data.unread_count)
    }
  }, [onCountUpdate])

  return useSSE('/api/sms/sse/unread-count', {
    enabled,
    onEvent: handleEvent,
  })
}

/**
 * Hook specifically for conversations list SSE
 */
export function useConversationsSSE(
  view: 'self' | 'all',
  options: {
    onConversationUpdate?: (conversationIds: string[]) => void
    enabled?: boolean
  } = {}
) {
  const { onConversationUpdate, enabled = true } = options

  const handleEvent = useCallback((eventType: string, data: any) => {
    if (eventType === 'conversation_update') {
      onConversationUpdate?.(data.updated_conversations)
    }
  }, [onConversationUpdate])

  return useSSE(`/api/sms/sse/conversations?view=${view}`, {
    enabled,
    onEvent: handleEvent,
  })
}
