"use client"

import { useState, useRef, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useAuth } from "@/providers/AuthProvider"
import { createClient } from "@/lib/supabase/client"
import { CreateConversationModal } from "@/components/modals/create-conversation-modal"
import { DraftListView } from "@/components/sms/draft-list-view"
import { InitialsAvatar } from "@/components/ui/initials-avatar"
import {
  Search,
  Send,
  UserCircle,
  CheckCheck,
  Loader2,
  MessageSquare,
  GripVertical,
  Filter,
  Plus,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  RefreshCw
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePersistedFilters } from "@/hooks/usePersistedFilters"
import { UpgradePrompt } from "@/components/upgrade-prompt"
import { useNotification } from '@/contexts/notification-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/useApiFetch'
import { queryKeys } from '@/hooks/queryKeys'
import { useSendMessage, useResolveNotification, useApproveDrafts, useRejectDrafts, useEditDraft, useRetryFailed } from '@/hooks/mutations'

interface Conversation {
  id: string
  dealId: string
  agentId: string
  clientName: string
  clientPhone: string
  lastMessage: string
  lastMessageAt: string | null
  unreadCount: number
  smsOptInStatus?: string
  optedInAt?: string
  optedOutAt?: string
  statusStandardized?: string | null
  hasNotification?: boolean
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  receiver_id: string
  body: string
  direction: 'inbound' | 'outbound'
  sent_at: string | null
  status: string
  metadata: any
}

interface DealDetails {
  id: string
  client_name: string
  client_phone: string | null
  client_email: string | null
  client_address: string | null
  state: string | null
  zipcode: string | null
  policy_number: string | null
  annual_premium: number
  monthly_premium: number
  policy_effective_date: string | null
  billing_day_of_month: string | null
  billing_weekday: string | null
  billing_cycle: string | null
  lead_source: string | null
  status: string
  status_standardized: string | null
  agent: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  carrier: {
    id: string
    name: string
  }
  product: {
    id: string
    name: string
  } | null
}

function SMSMessagingPageContent() {
  const { showSuccess, showError } = useNotification()
  const searchParams = useSearchParams()
  const conversationIdFromUrl = searchParams.get('conversation')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  // Create stable supabase client instance
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  // Persisted filter state using custom hook (for real-time filters, use setAndApply)
  const { appliedFilters, setAndApply } = usePersistedFilters(
    'communications',
    {
      searchQuery: "",
      notificationFilter: 'all' as 'all' | 'lapse' | 'needs_info' | 'drafts' | 'unread',
      viewMode: 'self' as 'downlines' | 'self',
      selectedConversationId: null as string | null
    }
  )

  // For real-time filters, use setAndApply which updates immediately
  const searchQuery = appliedFilters.searchQuery
  const notificationFilter = appliedFilters.notificationFilter
  const viewMode = appliedFilters.viewMode
  const persistedConversationId = appliedFilters.selectedConversationId

  const setSearchQuery = (value: string) => {
    setAndApply({ searchQuery: value })
  }
  const setNotificationFilter = (value: 'all' | 'lapse' | 'needs_info' | 'drafts' | 'unread') => {
    setAndApply({ notificationFilter: value })
  }
  const setViewMode = (value: 'downlines' | 'self') => {
    setAndApply({ viewMode: value, selectedConversationId: null })
  }
  const setPersistedConversationId = (value: string | null) => {
    setAndApply({ selectedConversationId: value })
  }

  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messageInput, setMessageInput] = useState("")
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [rightPanelWidth, setRightPanelWidth] = useState(350)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false)
  const [dealPanelCollapsed, setDealPanelCollapsed] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [editingDraftBody, setEditingDraftBody] = useState("")
  const [isHydrated, setIsHydrated] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const conversationRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const messageReadTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Event deduplication to prevent double-processing of real-time events
  // Events are tracked by messageId + eventType and cleared after 2 seconds
  const processedEventsRef = useRef<Set<string>>(new Set())
  const DEDUP_WINDOW_MS = 2000

  // Refs to hold current filter values for use in real-time subscription callbacks
  // This prevents stale closures when filters change but subscriptions remain active
  const filtersRef = useRef({ effectiveViewMode: 'self', searchQuery: '', notificationFilter: 'all' as 'all' | 'lapse' | 'needs_info' | 'drafts' | 'unread' })

  // Ref for selected conversation to avoid stale closures in subscriptions
  const selectedConversationRef = useRef<Conversation | null>(null)

  // Check if user is admin - migrated to useQuery
  const { data: adminData, isSuccess: isAdminChecked } = useQuery({
    queryKey: queryKeys.userProfile(user?.id),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('No user ID found')
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('id, is_admin, subscription_tier')
        .eq('auth_user_id', user.id)
        .single()

      if (error) {
        console.error('❌ Error checking admin status:', error)
        throw error
      }

      const isAdmin = userData?.is_admin || false
      const userTier = userData?.subscription_tier || 'free'
      const currentUserId = userData?.id || null

      console.log('🔐 Admin status:', isAdmin, 'Tier:', userTier)

      return { isAdmin, userTier, currentUserId }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const isAdmin = adminData?.isAdmin || false
  const userTier = adminData?.userTier || 'free'
  const currentUserId = adminData?.currentUserId || null

  // Conversations query - migrated to useApiFetch
  const effectiveViewMode = (isAdmin && viewMode === 'downlines') ? 'all' : viewMode

  // Keep filtersRef in sync with current values to prevent stale closures in subscriptions
  useEffect(() => {
    filtersRef.current = { effectiveViewMode, searchQuery, notificationFilter }
  }, [effectiveViewMode, searchQuery, notificationFilter])

  // Keep selectedConversationRef in sync to avoid stale closures in subscriptions
  useEffect(() => {
    selectedConversationRef.current = selectedConversation
  }, [selectedConversation])
  const { data: conversationsData, isPending: loading } = useApiFetch<{ conversations: Conversation[] }>(
    queryKeys.conversationsList(effectiveViewMode, { searchQuery, notificationFilter }),
    `/api/sms/conversations?view=${effectiveViewMode}`,
    {
      enabled: isAdminChecked,
      staleTime: 30 * 1000, // 30 seconds
      placeholderData: (previousData) => previousData, // Keep previous data while fetching (stale-while-revalidate)
    }
  )

  const conversations = conversationsData?.conversations || []

  // Messages query - migrated to useApiFetch
  const { data: messagesData, isPending: messagesLoading } = useApiFetch<{ messages: Message[] }>(
    queryKeys.messages(selectedConversation?.id || ''),
    `/api/sms/messages?conversationId=${selectedConversation?.id}&view=${effectiveViewMode}`,
    {
      enabled: !!selectedConversation?.id,
      staleTime: 30 * 1000, // 30 seconds - prevents excessive refetches
    }
  )

  // Sort messages: sent messages by sent_at, drafts (sent_at=null) always at bottom
  const messages = (messagesData?.messages || []).sort((a: Message, b: Message) => {
    if (!a.sent_at && !b.sent_at) return 0
    if (!a.sent_at) return 1
    if (!b.sent_at) return -1
    return new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
  })

  // Deal details query - migrated to useApiFetch
  const { data: dealData, isPending: dealLoading } = useApiFetch<{ deal: DealDetails }>(
    queryKeys.dealDetail(selectedConversation?.dealId || ''),
    `/api/deals/${selectedConversation?.dealId}`,
    {
      enabled: !!selectedConversation?.dealId,
      staleTime: 60 * 1000, // 1 minute
    }
  )

  const dealDetails = dealData?.deal || null

  // Update showDrafts based on filter selection
  const shouldShowDrafts = notificationFilter === 'drafts'

  // Set hydration flag after mount to prevent SSR/client mismatch
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Persist selected conversation ID using persisted filters
  useEffect(() => {
    if (selectedConversation?.id) {
      setPersistedConversationId(selectedConversation.id)
    }
  }, [selectedConversation])

  // Restore selected conversation when conversations are loaded
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversation && isHydrated && persistedConversationId && isAdminChecked) {
      const conversation = conversations.find(c => c.id === persistedConversationId)
      if (conversation) {
        // Directly set the conversation - queries will automatically fetch
        setSelectedConversation(conversation)
      } else {
        // Clear the persisted conversation ID if it's not in the current list
        // This happens when switching view modes or when the conversation is no longer accessible
        setPersistedConversationId(null)
      }
    }
  }, [conversations, selectedConversation, isHydrated, persistedConversationId, isAdminChecked])

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.clientPhone.includes(searchQuery);

    if (!matchesSearch) return false;

    // Apply notification filter
    if (notificationFilter === 'lapse') {
      return conv.statusStandardized === 'lapse_notified';
    } else if (notificationFilter === 'needs_info') {
      return conv.statusStandardized === 'needs_more_info_notified';
    } else if (notificationFilter === 'unread') {
      return conv.unreadCount > 0;
    }

    return true; // 'all' shows everything
  })

  const totalUnreadCount = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Resize handlers
  const handleMouseDownSidebar = useCallback(() => {
    setIsResizingSidebar(true)
  }, [])

  const handleMouseDownRightPanel = useCallback(() => {
    setIsResizingRightPanel(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = e.clientX
      if (newWidth >= 200 && newWidth <= 800) {
        setSidebarWidth(newWidth)
      }
    }
    if (isResizingRightPanel) {
      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= 200 && newWidth <= 800) {
        setRightPanelWidth(newWidth)
      }
    }
  }, [isResizingSidebar, isResizingRightPanel])

  const handleMouseUp = useCallback(() => {
    setIsResizingSidebar(false)
    setIsResizingRightPanel(false)
  }, [])

  useEffect(() => {
    if (isResizingSidebar || isResizingRightPanel) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizingSidebar, isResizingRightPanel, handleMouseMove, handleMouseUp])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-resize message input textarea
  useEffect(() => {
    const textarea = messageInputRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 150) // Max 150px
      textarea.style.height = `${newHeight}px`
    }
  }, [messageInput])

  // Clear selected conversation when view mode changes to avoid permission issues
  useEffect(() => {
    setSelectedConversation(null)
  }, [viewMode])

  const handleConversationSelect = useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation)
    // Queries will automatically fetch when selectedConversation changes
    // Real-time subscription will handle updating unread counts
  }, [])

  // Subscribe to real-time updates - Global subscription for all conversations
  useEffect(() => {
    if (!user?.id) {
      console.log('⚠️ Skipping real-time setup - no user')
      return
    }

    console.log('🔔 Setting up global real-time subscription for all conversations')

    // Create a unique channel name based on user ID
    const channelName = `realtime-sms-all-${user.id}`

    const allConversationsChannel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('📨 New message in any conversation:', payload.new)
          const newMessage = payload.new as Message

          // Event deduplication - prevent double-processing
          const eventKey = `global-${newMessage.id}-INSERT`
          if (processedEventsRef.current.has(eventKey)) {
            console.log('🔄 Skipping duplicate global event:', eventKey)
            return
          }
          processedEventsRef.current.add(eventKey)
          setTimeout(() => processedEventsRef.current.delete(eventKey), DEDUP_WINDOW_MS)

          // Use ref to get current selected conversation and avoid stale closures
          const currentSelectedId = selectedConversationRef.current?.id

          // If this message is for a conversation that's not selected, invalidate conversations
          // Use filtersRef.current to get fresh filter values and avoid stale closures
          if (newMessage.conversation_id !== currentSelectedId && newMessage.direction === 'inbound') {
            const { effectiveViewMode: mode, searchQuery: search, notificationFilter: filter } = filtersRef.current
            queryClient.invalidateQueries({ queryKey: queryKeys.conversationsList(mode, { searchQuery: search, notificationFilter: filter }) })
          }
        }
      )
      .subscribe((status, err) => {
        console.log('🔌 Global real-time channel status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to global real-time updates!')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error:', err)
        }
      })

    // Cleanup on unmount
    return () => {
      console.log('🔕 Cleaning up global real-time subscription')
      supabase.removeChannel(allConversationsChannel)
    }
  }, [user?.id]) // Removed selectedConversation?.id - using ref instead to avoid re-subscriptions

  // Subscribe to real-time updates - Only for the selected conversation
  useEffect(() => {
    if (!user?.id || !selectedConversation) {
      console.log('⚠️ Skipping conversation-specific real-time setup - no conversation selected')
      return
    }

    console.log('🔔 Setting up real-time subscriptions for conversation:', selectedConversation.id)

    // Create a unique channel name based on user ID and conversation ID
    const channelName = `realtime-sms-${user.id}-${selectedConversation.id}`

    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          console.log('📨 New message received via real-time:', payload.new)
          const newMessage = payload.new as Message

          // Event deduplication - prevent double-processing
          const eventKey = `specific-${newMessage.id}-INSERT`
          if (processedEventsRef.current.has(eventKey)) {
            console.log('🔄 Skipping duplicate specific event:', eventKey)
            return
          }
          processedEventsRef.current.add(eventKey)
          setTimeout(() => processedEventsRef.current.delete(eventKey), DEDUP_WINDOW_MS)

          console.log('✅ Message belongs to current conversation - invalidating queries')

          // Invalidate messages query to refetch
          queryClient.invalidateQueries({ queryKey: queryKeys.messages(selectedConversation.id) })

          // Invalidate conversations list to update last message
          // Use filtersRef.current to get fresh filter values and avoid stale closures
          const { effectiveViewMode: mode, searchQuery: search, notificationFilter: filter } = filtersRef.current
          queryClient.invalidateQueries({ queryKey: queryKeys.conversationsList(mode, { searchQuery: search, notificationFilter: filter }) })

          // If it's an inbound message, mark it as read after a short delay
          // Track timeout to prevent race conditions on rapid messages or unmount
          if (newMessage.direction === 'inbound') {
            const messageId = newMessage.id

            // Clear any existing timeout for this message to prevent duplicates
            const existingTimeout = messageReadTimeoutsRef.current.get(messageId)
            if (existingTimeout) {
              clearTimeout(existingTimeout)
            }

            const timeoutId = setTimeout(async () => {
              // Remove from tracking after execution
              messageReadTimeoutsRef.current.delete(messageId)

              try {
                await supabase
                  .from('messages')
                  .update({ read_at: new Date().toISOString() })
                  .eq('id', messageId)
                  .is('read_at', null)
                console.log('✅ Marked message as read')

                // Invalidate conversations to update unread count
                // Get fresh filter values at the time of invalidation
                const { effectiveViewMode: currentMode, searchQuery: currentSearch, notificationFilter: currentFilter } = filtersRef.current
                queryClient.invalidateQueries({ queryKey: queryKeys.conversationsList(currentMode, { searchQuery: currentSearch, notificationFilter: currentFilter }) })
              } catch (error) {
                console.error('❌ Error marking message as read:', error)
              }
            }, 1000)

            // Track the timeout so it can be cleaned up
            messageReadTimeoutsRef.current.set(messageId, timeoutId)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          console.log('📝 Message updated:', payload.new)
          // Invalidate messages query to refetch and re-sort
          queryClient.invalidateQueries({ queryKey: queryKeys.messages(selectedConversation.id) })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          console.log('🔄 Current conversation updated:', payload)
          // Invalidate conversations list to update opt-in/opt-out status
          // Use filtersRef.current to get fresh filter values and avoid stale closures
          const { effectiveViewMode: mode, searchQuery: search, notificationFilter: filter } = filtersRef.current
          queryClient.invalidateQueries({ queryKey: queryKeys.conversationsList(mode, { searchQuery: search, notificationFilter: filter }) })
        }
      )
      .subscribe((status, err) => {
        console.log('🔌 Real-time channel status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time updates!')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error:', err)
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Channel subscription timed out')
        } else if (status === 'CLOSED') {
          console.log('🔒 Channel closed')
        }
      })

    // Cleanup on unmount or conversation change
    return () => {
      console.log('🔕 Cleaning up real-time subscription')
      if (conversationRefreshTimeoutRef.current) {
        clearTimeout(conversationRefreshTimeoutRef.current)
      }
      // Clear all pending message read timeouts to prevent race conditions
      messageReadTimeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout)
      })
      messageReadTimeoutsRef.current.clear()
      supabase.removeChannel(channel)
    }
  }, [user?.id, selectedConversation?.id]) // Removed debouncedRefreshConversations to avoid re-subscriptions

  // Auto-select conversation from URL parameter
  useEffect(() => {
    if (conversationIdFromUrl && conversations.length > 0 && !selectedConversation) {
      const conversation = conversations.find(c => c.id === conversationIdFromUrl)
      if (conversation) {
        handleConversationSelect(conversation)
      }
    }
  }, [conversationIdFromUrl, conversations, selectedConversation, handleConversationSelect])

  // Send message mutation - using centralized hook
  // Note: The hook uses predicate-based invalidation to catch all conversation variations
  const sendMessageMutation = useSendMessage({
    conversationId: selectedConversationRef.current?.id,
    onSuccess: () => {
      // Also invalidate messages query for the current conversation
      const currentConversationId = selectedConversationRef.current?.id
      if (currentConversationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(currentConversationId) })
      }
    },
    onError: (error: Error) => {
      console.error('Error sending message:', error)
      showError(error.message || 'Failed to send message')
    }
  })

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || sendMessageMutation.isPending) return

    const messageText = messageInput.trim()

    // Clear input immediately for better UX
    setMessageInput("")

    // Reset textarea height after sending
    if (messageInputRef.current) {
      messageInputRef.current.style.height = 'auto'
    }

    try {
      await sendMessageMutation.mutateAsync({
        dealId: selectedConversation.dealId,
        message: messageText,
      })
    } catch (error) {
      // Restore message input on error
      setMessageInput(messageText)
    }
  }

  const sending = sendMessageMutation.isPending

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Resolve notification mutation - using centralized hook
  // Note: The hook uses predicate-based invalidation to catch all conversation and deal variations
  const resolveNotificationMutation = useResolveNotification({
    onSuccess: () => {
      showSuccess('Notification resolved successfully')
    },
    onError: (error: Error) => {
      console.error('Error resolving notification:', error)
      showError(error.message || 'Failed to resolve notification')
    }
  })

  const handleResolveNotification = () => {
    if (!dealDetails || resolveNotificationMutation.isPending) return
    resolveNotificationMutation.mutate(dealDetails.id)
  }

  const resolving = resolveNotificationMutation.isPending

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`

    return date.toLocaleDateString()
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Helper to get the Nth occurrence of a weekday in a month
  const getNthWeekdayOfMonth = (year: number, month: number, nth: string, weekday: string): Date | null => {
    const nthInt = { '1st': 1, '2nd': 2, '3rd': 3, '4th': 4 }[nth] || 1
    const targetWeekday = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0 }[weekday] || 0

    const firstDay = new Date(year, month, 1)
    const firstWeekday = firstDay.getDay()

    // Calculate days until first occurrence
    let daysUntilFirst = targetWeekday - firstWeekday
    if (daysUntilFirst < 0) daysUntilFirst += 7

    // Calculate the nth occurrence
    const nthOccurrence = new Date(year, month, 1 + daysUntilFirst + (nthInt - 1) * 7)

    // Check if still in same month
    if (nthOccurrence.getMonth() !== month) return null

    return nthOccurrence
  }

  const calculateNextBillingDate = (
    effectiveDate: string | null,
    billingCycle: string | null,
    billingDayOfMonth: string | null = null,
    billingWeekday: string | null = null
  ): string => {
    if (!billingCycle) return 'N/A'

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // If custom billing pattern is set, use it
    if (billingDayOfMonth && billingWeekday) {
      const incrementMonths = {
        'monthly': 1,
        'quarterly': 3,
        'semi-annually': 6,
        'annually': 12
      }[billingCycle] || 1

      let testDate = new Date(today)
      testDate.setDate(1) // Start from first of current month

      // Search forward up to 50 billing cycles
      for (let i = 0; i < 50; i++) {
        const candidateDate = getNthWeekdayOfMonth(
          testDate.getFullYear(),
          testDate.getMonth(),
          billingDayOfMonth,
          billingWeekday
        )

        if (candidateDate && candidateDate > today) {
          return candidateDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        }

        // Move to next billing period
        testDate.setMonth(testDate.getMonth() + incrementMonths)
      }

      return 'N/A'
    }

    // Fallback to old calculation using policy effective date
    if (!effectiveDate) return 'N/A'

    const [year, month, day] = effectiveDate.split('T')[0].split('-')
    const effective = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    let nextBilling = new Date(effective)

    const incrementMonths = {
      'monthly': 1,
      'quarterly': 3,
      'semi-annually': 6,
      'annually': 12
    }[billingCycle] || 1

    while (nextBilling <= today) {
      nextBilling.setMonth(nextBilling.getMonth() + incrementMonths)
    }

    return nextBilling.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleConversationCreated = useCallback(async (conversationId: string) => {
    // Use filtersRef.current to get fresh filter values
    const { effectiveViewMode: mode, searchQuery: search, notificationFilter: filter } = filtersRef.current

    // Invalidate conversations query and wait for refetch to complete
    await queryClient.invalidateQueries({ queryKey: queryKeys.conversationsList(mode, { searchQuery: search, notificationFilter: filter }) })

    // Refetch and get the updated data directly
    const data = await queryClient.fetchQuery({
      queryKey: queryKeys.conversationsList(mode, { searchQuery: search, notificationFilter: filter }),
      staleTime: 0, // Force fresh fetch
    }) as { conversations: Conversation[] } | undefined

    // Find and select the new conversation from the fresh data
    const conversation = data?.conversations?.find(c => c.id === conversationId)
    if (conversation) {
      handleConversationSelect(conversation)
    }
  }, [queryClient, handleConversationSelect])

  // Approve draft mutation - using centralized hook
  const approveDraftMutation = useApproveDrafts({
    onSuccess: () => {
      // Also invalidate messages query for the current conversation
      const currentConversationId = selectedConversationRef.current?.id
      if (currentConversationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(currentConversationId) })
      }
      console.log('✅ Draft approved successfully')
    },
    onError: (error: Error) => {
      console.error('Error approving draft:', error)
      showError(error.message || 'Failed to approve draft')
    }
  })

  const handleApproveDraft = (messageId: string) => {
    approveDraftMutation.mutate({ messageIds: [messageId] })
  }

  // Reject draft mutation - using centralized hook
  const rejectDraftMutation = useRejectDrafts({
    onSuccess: () => {
      // Also invalidate messages query for the current conversation
      const currentConversationId = selectedConversationRef.current?.id
      if (currentConversationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(currentConversationId) })
      }
      console.log('✅ Draft rejected successfully')
    },
    onError: (error: Error) => {
      console.error('Error rejecting draft:', error)
      showError(error.message || 'Failed to reject draft')
    }
  })

  const handleRejectDraft = (messageId: string) => {
    rejectDraftMutation.mutate({ messageIds: [messageId] })
  }

  const handleStartEditDraft = (messageId: string, currentBody: string) => {
    setEditingDraftId(messageId)
    setEditingDraftBody(currentBody)
  }

  const handleCancelEditDraft = () => {
    setEditingDraftId(null)
    setEditingDraftBody("")
  }

  // Edit draft mutation - using centralized hook
  const editDraftMutation = useEditDraft({
    onSuccess: () => {
      // Also invalidate messages query for the current conversation
      const currentConversationId = selectedConversationRef.current?.id
      if (currentConversationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(currentConversationId) })
      }
      setEditingDraftId(null)
      setEditingDraftBody("")
      console.log('✅ Draft updated successfully')
    },
    onError: (error: Error) => {
      console.error('Error updating draft:', error)
      showError(error.message || 'Failed to update draft')
    }
  })

  const handleSaveEditDraft = (messageId: string) => {
    editDraftMutation.mutate({ messageId, body: editingDraftBody })
  }

  // Retry failed mutation - using centralized hook
  const retryFailedMutation = useRetryFailed({
    onSuccess: () => {
      const currentConversationId = selectedConversationRef.current?.id
      if (currentConversationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(currentConversationId) })
      }
      console.log('✅ Failed message retried successfully')
    },
    onError: (error: Error) => {
      console.error('Error retrying failed message:', error)
      showError(error.message || 'Failed to retry message')
    }
  })

  const handleRetryFailed = (messageId: string) => {
    retryFailedMutation.mutate({ messageIds: [messageId] })
  }

  // Combined pending state for draft actions - disable all buttons when any draft mutation is in progress
  const isDraftMutationPending = approveDraftMutation.isPending || rejectDraftMutation.isPending || editDraftMutation.isPending || retryFailedMutation.isPending

  return (
    <div className="h-[calc(100vh-3rem)] flex bg-background relative communication-content" data-tour="communication">
      {/* Upgrade prompt overlay for Basic tier viewing downlines */}
      {userTier === 'basic' && viewMode === 'downlines' && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <div className="h-full flex items-center justify-center pointer-events-auto">
            <UpgradePrompt
              title="Upgrade to View Downline Data"
              message="Upgrade to Pro or Expert tier to view and manage your team's conversations"
              requiredTier="Pro"
              blur={false}
            />
          </div>
        </div>
      )}

      {/* Conversations Sidebar */}
      <div
        className="bg-card border-r border-border flex flex-col"
        style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: '800px' }}
      >
        {/* Header - Always interactive */}
        <div className="p-4 border-b border-border relative z-[60]">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">Messages</h1>
          </div>

          {/* Filter Dropdown */}
          <div className="mb-4">
            <Select value={notificationFilter} onValueChange={(value: 'all' | 'lapse' | 'needs_info' | 'drafts' | 'unread') => setNotificationFilter(value)}>
              <SelectTrigger className="w-full h-8 text-xs">
                <Filter className="h-3 w-3 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                <SelectItem value="all">All Messages</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="lapse">Lapse Notifications</SelectItem>
                <SelectItem value="needs_info">Needs More Info</SelectItem>
                <SelectItem value="drafts">View Drafts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Toggle with Slider */}
          <div className="relative bg-accent/30 rounded-lg p-1 mb-4">
            <div className="grid grid-cols-2 gap-1 relative">
              {/* Animated slider background - only render after hydration to prevent mismatch */}
              {isHydrated && (
                <div
                  className={cn(
                    "absolute h-[calc(100%-8px)] bg-primary rounded-md top-1 shadow-md",
                    "transition-all duration-300 ease-in-out",
                    viewMode === 'self' ? 'left-1 right-[calc(50%+2px)]' : 'left-[calc(50%+2px)] right-1'
                  )}
                />
              )}

              {/* Buttons */}
              <button
                onClick={() => setViewMode('self')}
                className={cn(
                  "relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300",
                  isHydrated && viewMode === 'self'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Just Me
              </button>
              <button
                onClick={() => setViewMode('downlines')}
                className={cn(
                  "relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300",
                  isHydrated && viewMode === 'downlines'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Downlines
              </button>
            </div>
          </div>

          {/* Search and New Button - Only show for regular conversations */}
          {!shouldShowDrafts && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background"
                />
              </div>
              <Button
                onClick={() => setCreateModalOpen(true)}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-4 whitespace-nowrap"
              >
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
          )}
        </div>

        {/* Conversations List or Drafts View */}
        {shouldShowDrafts ? (
          <DraftListView
            viewMode={(isAdmin && viewMode === 'downlines') ? 'all' : viewMode}
            onConversationClick={(conversationId) => {
              // Find the conversation and select it
              const conversation = conversations.find(c => c.id === conversationId)
              if (conversation) {
                handleConversationSelect(conversation)
              } else {
                // If conversation not in current list, invalidate to refetch
                queryClient.invalidateQueries({ queryKey: queryKeys.conversationsList(effectiveViewMode, { searchQuery, notificationFilter }) })
              }
            }}
          />
        ) : (
          <div className={cn(
            "flex-1 overflow-y-auto custom-scrollbar",
            userTier === 'basic' && viewMode === 'downlines' && "blur-sm pointer-events-none"
          )}>
          {(loading || !isAdminChecked) ? (
            <div className="p-2 space-y-2 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                  <div className="h-10 w-10 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-48 bg-muted rounded" />
                  </div>
                  <div className="h-3 w-12 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground text-sm">
                {searchQuery ? 'No conversations found' : 'No conversations yet. Try creating a conversation.'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleConversationSelect(conversation)}
                className={cn(
                  "p-4 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors relative",
                  selectedConversation?.id === conversation.id && "bg-accent"
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <InitialsAvatar name={conversation.clientName} size="md" />
                    {conversation.unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                      </div>
                    )}
                    {(conversation.statusStandardized === 'lapse_notified' || conversation.statusStandardized === 'needs_more_info_notified') && (
                      <div className="absolute -bottom-1 -right-1 bg-yellow-500 rounded-full h-3 w-3 border-2 border-white"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={cn(
                        "font-medium truncate",
                        conversation.unreadCount > 0 ? "text-foreground font-semibold" : "text-foreground"
                      )}>{conversation.clientName}</h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {conversation.lastMessageAt ? formatTimestamp(conversation.lastMessageAt) : ''}
                      </span>
                    </div>
                    <p className={cn(
                      "text-sm truncate mt-1",
                      conversation.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      {conversation.lastMessage || 'No messages yet'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{conversation.clientPhone}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          </div>
        )}
      </div>

      {/* Resize Handle for Sidebar */}
      <div
        className="w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors flex-shrink-0 group relative"
        onMouseDown={handleMouseDownSidebar}
      >
        <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        userTier === 'basic' && viewMode === 'downlines' && "blur-sm pointer-events-none"
      )}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-card border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <InitialsAvatar name={selectedConversation.clientName} size="sm" />
                  <div>
                    <h2 className="font-semibold text-foreground">{selectedConversation.clientName}</h2>
                    <p className="text-sm text-muted-foreground">{selectedConversation.clientPhone}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-muted/30">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-muted-foreground text-sm">No messages yet. Start the conversation!</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => {
                    const isOutbound = message.direction === 'outbound'
                    const isAutomated = message.metadata?.automated
                    const isDraft = message.status === 'draft'
                    const isFailed = message.status === 'failed'
                    const isEditing = editingDraftId === message.id

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          isOutbound ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
                            isDraft
                              ? "bg-yellow-100 dark:bg-yellow-900/30 text-gray-900 dark:text-gray-100 border-2 border-yellow-400 dark:border-yellow-600"
                              : isFailed
                              ? "bg-red-100 dark:bg-red-900/30 text-gray-900 dark:text-gray-100 border-2 border-red-400 dark:border-red-600"
                              : isOutbound
                              ? "bg-blue-600 text-white"
                              : "bg-card text-card-foreground border border-border"
                          )}
                        >
                          {isDraft && (
                            <div className="text-xs font-semibold mb-2 text-yellow-800 dark:text-yellow-400 flex items-center gap-1">
                              <span className="inline-block w-2 h-2 bg-yellow-500 dark:bg-yellow-400 rounded-full"></span>
                              DRAFT - Pending Approval
                            </div>
                          )}
                          {isFailed && (
                            <div className="mb-2">
                              <div className="text-xs font-semibold text-red-800 dark:text-red-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                FAILED - {message.metadata?.error || 'Message could not be delivered'}
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleRetryFailed(message.id)}
                                disabled={isDraftMutationPending}
                                className="mt-2 bg-red-600 hover:bg-red-700 text-white text-xs"
                              >
                                {retryFailedMutation.isPending && retryFailedMutation.variables?.messageIds?.includes(message.id) ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                )}
                                Retry
                              </Button>
                            </div>
                          )}
                          {isAutomated && !isDraft && (
                            <div className="text-xs opacity-75 mb-1 italic">
                              Automated message
                            </div>
                          )}

                          {isEditing ? (
                            <div className="space-y-3">
                              <textarea
                                value={editingDraftBody}
                                onChange={(e) => setEditingDraftBody(e.target.value)}
                                className="w-full text-sm p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-yellow-500 dark:focus:ring-yellow-400 focus:border-yellow-500 dark:focus:border-yellow-400 resize-none"
                                rows={8}
                                style={{ minHeight: '150px' }}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveEditDraft(message.id)}
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs px-4"
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEditDraft}
                                  className="text-xs px-4"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>

                              {isDraft && (
                                <div className="mt-3 pt-2 border-t border-yellow-300 dark:border-yellow-700 -mx-4 px-4 overflow-x-auto">
                                  <div className="flex gap-2 min-w-max">
                                    <Button
                                      size="sm"
                                      onClick={() => handleApproveDraft(message.id)}
                                      disabled={isDraftMutationPending}
                                      className="bg-green-600 hover:bg-green-700 text-white text-xs flex-1 min-w-[110px]"
                                    >
                                      {approveDraftMutation.isPending && approveDraftMutation.variables?.messageIds?.includes(message.id) ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        'Approve & Send'
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleStartEditDraft(message.id, message.body)}
                                      disabled={isDraftMutationPending}
                                      className="text-xs min-w-[60px] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleRejectDraft(message.id)}
                                      disabled={isDraftMutationPending}
                                      className="text-xs min-w-[60px]"
                                    >
                                      {rejectDraftMutation.isPending && rejectDraftMutation.variables?.messageIds?.includes(message.id) ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        'Reject'
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {!isDraft && (
                                <div className="flex items-center justify-end mt-1 space-x-1">
                                  <span className={cn(
                                    "text-xs",
                                    isFailed ? "text-red-700 dark:text-red-400" : isOutbound ? "opacity-75" : "text-gray-500"
                                  )}>
                                    {isFailed ? 'Failed' : message.sent_at ? formatMessageTime(message.sent_at) : 'Pending'}
                                  </span>
                                  {isOutbound && !isFailed && (
                                    <CheckCheck className={cn(
                                      "h-3 w-3",
                                      message.status === 'delivered' ? "opacity-100" : "opacity-50"
                                    )} />
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 bg-card border-t border-border">
              {(() => {
                console.log('🔍 Message input check:', {
                  currentUserId,
                  conversationAgentId: selectedConversation.agentId,
                  matches: selectedConversation.agentId === currentUserId,
                  shouldBlock: currentUserId && selectedConversation.agentId !== currentUserId
                })
                return null
              })()}
              {currentUserId && selectedConversation.agentId !== currentUserId ? (
                <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground text-center">
                    This is not your conversation. You can only send messages in conversations where you are the agent.
                  </p>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    ref={messageInputRef}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type a message..."
                    disabled={sending}
                    rows={1}
                    className="flex-1 min-h-[40px] max-h-[150px] px-3 py-2 text-sm rounded-lg border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 bg-input text-foreground transition-all resize-none overflow-y-auto focus:outline-none"
                    style={{
                      scrollbarWidth: 'thin'
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sending}
                    className="btn-gradient h-10 px-4"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Select a conversation</h3>
              <p className="text-muted-foreground">Choose a client to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Resize Handle for Right Panel */}
      {selectedConversation && (
        <div
          className="w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors flex-shrink-0 group relative"
          onMouseDown={handleMouseDownRightPanel}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Deal Details Panel */}
      {selectedConversation && (
        <div
          className={cn(
            "bg-card border-l border-border flex flex-col custom-scrollbar transition-all duration-300 ease-in-out",
            userTier === 'basic' && viewMode === 'downlines' && "blur-sm pointer-events-none"
          )}
          style={{
            width: dealPanelCollapsed ? '60px' : `${rightPanelWidth}px`,
            minWidth: dealPanelCollapsed ? '60px' : '200px',
            maxWidth: dealPanelCollapsed ? '60px' : '800px'
          }}
        >
          <div className="p-5 border-b border-border sticky top-0 bg-card z-10 flex items-center justify-between">
            {!dealPanelCollapsed && (
              <h2 className="text-xl font-semibold text-foreground">Deal Information</h2>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDealPanelCollapsed(!dealPanelCollapsed)}
              className={cn("hover:bg-accent", dealPanelCollapsed && "mx-auto")}
            >
              {dealPanelCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5 rotate-90" />
              )}
            </Button>
          </div>

          {!dealPanelCollapsed && (
            <div className="overflow-y-auto flex-1">

          {dealLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dealDetails ? (
            <div className="p-5 space-y-7">
              {/* Notification Alert */}
              {dealDetails.status_standardized === 'lapse_notified' && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-800">Lapse Notification</h4>
                      <p className="text-xs text-yellow-700 mt-1">This policy is pending lapse. Client has been notified.</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleResolveNotification}
                      disabled={resolving}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resolve'}
                    </Button>
                  </div>
                </div>
              )}

              {dealDetails.status_standardized === 'needs_more_info_notified' && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-800">Needs More Info</h4>
                      <p className="text-xs text-yellow-700 mt-1">Additional information required for this client.</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleResolveNotification}
                      disabled={resolving}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resolve'}
                    </Button>
                  </div>
                </div>
              )}

              {/* SMS Opt-out Status - Only show if client has opted out */}
              {selectedConversation && selectedConversation.smsOptInStatus === 'opted_out' && (
                <div className="border-l-4 p-4 rounded bg-red-50 border-red-400">
                  <h4 className="text-sm font-semibold mb-1 text-red-800">
                    SMS Status
                  </h4>
                  <p className="text-xs text-red-700">
                    Client has opted out of SMS messages. They will not receive any automated messages.
                  </p>
                </div>
              )}

              {/* Client Information */}
              <div>
                <h3 className="text-base font-bold text-foreground mb-4 flex items-center pb-2 border-b border-border">
                  <UserCircle className="h-5 w-5 mr-2 text-primary" />
                  Client Information
                </h3>
                <div className="space-y-3">
                  <DetailRow label="Name" value={dealDetails.client_name} />
                  <DetailRow label="Phone" value={dealDetails.client_phone} />
                  <DetailRow label="Email" value={dealDetails.client_email} />
                  <DetailRow label="Address" value={dealDetails.client_address} />
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="State" value={dealDetails.state} />
                    <DetailRow label="Zip" value={dealDetails.zipcode} />
                  </div>
                </div>
              </div>

              {/* Policy Information */}
              <div>
                <h3 className="text-base font-bold text-foreground mb-4 pb-2 border-b border-border">Policy Details</h3>
                <div className="space-y-3">
                  <DetailRow label="Policy Number" value={dealDetails.policy_number} />
                  <DetailRow
                    label="Annual Premium"
                    value={`$${dealDetails.annual_premium.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
                  <DetailRow
                    label="Monthly Premium"
                    value={`$${dealDetails.monthly_premium.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
                  <DetailRow
                    label="Effective Date"
                    value={dealDetails.policy_effective_date ? (() => {
                      // Parse date as local time to avoid timezone shifts
                      const [year, month, day] = dealDetails.policy_effective_date.split('T')[0].split('-')
                      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    })() : 'N/A'}
                  />
                  {dealDetails.billing_day_of_month && dealDetails.billing_weekday && (
                    <DetailRow
                      label="Billing Pattern"
                      value={`${dealDetails.billing_day_of_month} ${dealDetails.billing_weekday}`}
                    />
                  )}
                  <DetailRow
                    label="Next Billing Date"
                    value={calculateNextBillingDate(
                      dealDetails.policy_effective_date,
                      dealDetails.billing_cycle,
                      dealDetails.billing_day_of_month,
                      dealDetails.billing_weekday
                    )}
                    highlight
                  />
                  <DetailRow
                    label="Billing Cycle"
                    value={dealDetails.billing_cycle ? dealDetails.billing_cycle.charAt(0).toUpperCase() + dealDetails.billing_cycle.slice(1) : 'N/A'}
                  />
                  <DetailRow
                    label="Status"
                    value={dealDetails.status.charAt(0).toUpperCase() + dealDetails.status.slice(1)}
                  />
                </div>
              </div>

              {/* Provider Information */}
              <div>
                <h3 className="text-base font-bold text-foreground mb-4 pb-2 border-b border-border">Provider Information</h3>
                <div className="space-y-3">
                  <DetailRow
                    label="Agent"
                    value={`${dealDetails.agent.first_name} ${dealDetails.agent.last_name}`}
                  />
                  <DetailRow label="Carrier" value={dealDetails.carrier.name} />
                  <DetailRow label="Product" value={dealDetails.product?.name || 'N/A'} />
                </div>
              </div>

              {/* Additional Information */}
              <div>
                <h3 className="text-base font-bold text-foreground mb-4 pb-2 border-b border-border">Additional Details</h3>
                <div className="space-y-3">
                  <DetailRow label="Lead Source" value={dealDetails.lead_source} />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Unable to load deal information</p>
            </div>
          )}
            </div>
          )}
        </div>
      )}

      {/* Create Conversation Modal */}
      <CreateConversationModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  )
}

// Helper component for displaying detail rows
function DetailRow({
  label,
  value,
  highlight = false,
  className = ""
}: {
  label: string
  value: string | null | undefined
  highlight?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-col py-2 px-3 rounded-lg bg-accent/30", className)}>
      <span className="text-xs font-medium text-muted-foreground mb-1">{label}</span>
      <span className={cn(
        "text-sm font-semibold",
        highlight ? "text-primary text-base" : "text-foreground",
        !value && "text-muted-foreground italic font-normal"
      )}>
        {value || 'N/A'}
      </span>
    </div>
  )
}

export default function SMSMessagingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <SMSMessagingPageContent />
    </Suspense>
  )
}
