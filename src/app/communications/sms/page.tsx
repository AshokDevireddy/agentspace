"use client"

import { useState, useRef, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useAuth } from "@/providers/AuthProvider"
import { createClient } from "@/lib/supabase/client"
import {
  Search,
  Send,
  UserCircle,
  CheckCheck,
  Loader2,
  MessageSquare,
  GripVertical,
  Filter
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Conversation {
  id: string
  dealId: string
  clientName: string
  clientPhone: string
  lastMessage: string
  lastMessageAt: string
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
  sent_at: string
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
  const searchParams = useSearchParams()
  const conversationIdFromUrl = searchParams.get('conversation')
  const { user } = useAuth()
  // Create stable supabase client instance
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [dealDetails, setDealDetails] = useState<DealDetails | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [messageInput, setMessageInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [dealLoading, setDealLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [rightPanelWidth, setRightPanelWidth] = useState(350)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [viewMode, setViewMode] = useState<'downlines' | 'self' | 'all'>('self')
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'lapse' | 'needs_info'>('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasSetInitialViewMode = useRef(false)
  const conversationRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.clientPhone.includes(searchQuery);

    if (!matchesSearch) return false;

    // Apply notification filter
    if (notificationFilter === 'lapse') {
      return conv.statusStandardized === 'lapse_notified';
    } else if (notificationFilter === 'needs_info') {
      return conv.statusStandardized === 'needs_more_info_notified';
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
      if (newWidth >= 250 && newWidth <= 500) {
        setSidebarWidth(newWidth)
      }
    }
    if (isResizingRightPanel) {
      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= 280 && newWidth <= 600) {
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

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) {
        console.log('⚠️  No user ID found')
        return
      }

      console.log('👤 Checking admin status for user:', user.id)

      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('auth_user_id', user.id)
        .single()

      if (error) {
        console.error('❌ Error checking admin status:', error)
      }

      const adminStatus = userData?.is_admin || false
      console.log('🔐 Admin status:', adminStatus)
      setIsAdmin(adminStatus)
    }

    checkAdminStatus()
  }, [user?.id])

  // Set initial view mode based on admin status
  useEffect(() => {
    if (!hasSetInitialViewMode.current && user?.id) {
      if (isAdmin) {
        setViewMode('downlines') // Admins start with downlines which fetches all for them
      }
      hasSetInitialViewMode.current = true
    }
  }, [isAdmin, user?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchConversations = useCallback(async () => {
    try {
      // For admins viewing "downlines", we actually fetch "all"
      const effectiveViewMode = (isAdmin && viewMode === 'downlines') ? 'all' : viewMode
      console.log('🔄 Fetching conversations with view mode:', effectiveViewMode)

      const response = await fetch(`/api/sms/conversations?view=${effectiveViewMode}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        console.error('❌ Response not OK:', response.status, response.statusText)
        throw new Error('Failed to fetch conversations')
      }

      const data = await response.json()
      console.log('✅ Received conversations:', data.conversations?.length || 0)

      if (data.conversations?.length > 0) {
        console.log('📝 Sample conversation:', data.conversations[0])
      }

      setConversations(data.conversations || [])
    } catch (error) {
      console.error('❌ Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, viewMode])

  // Initial fetch and when view mode changes
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations]) // Include fetchConversations in dependencies

  // Debounced conversation refresh to avoid hammering the API
  const debouncedRefreshConversations = useCallback(() => {
    if (conversationRefreshTimeoutRef.current) {
      clearTimeout(conversationRefreshTimeoutRef.current)
    }
    conversationRefreshTimeoutRef.current = setTimeout(() => {
      fetchConversations()
    }, 500) // Wait 500ms before refreshing
  }, [fetchConversations])

  const fetchMessages = async (conversationId: string) => {
    try {
      setMessagesLoading(true)
      const response = await fetch(
        `/api/sms/messages?conversationId=${conversationId}`,
        { credentials: 'include' }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }

      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setMessagesLoading(false)
    }
  }

  const fetchDealDetails = async (dealId: string) => {
    try {
      setDealLoading(true)
      const response = await fetch(`/api/deals/${dealId}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch deal details')
      }

      const data = await response.json()
      setDealDetails(data.deal || null)
    } catch (error) {
      console.error('Error fetching deal details:', error)
      setDealDetails(null)
    } finally {
      setDealLoading(false)
    }
  }

  const handleConversationSelect = useCallback(async (conversation: Conversation) => {
    setSelectedConversation(conversation)
    await fetchMessages(conversation.id)
    fetchDealDetails(conversation.dealId)
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

          // If this message is for a conversation that's not selected, update unread count
          if (newMessage.conversation_id !== selectedConversation?.id && newMessage.direction === 'inbound') {
            setConversations(prev => prev.map(conv =>
              conv.id === newMessage.conversation_id
                ? {
                    ...conv,
                    unreadCount: conv.unreadCount + 1,
                    lastMessage: newMessage.body,
                    lastMessageAt: newMessage.sent_at
                  }
                : conv
            ))
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
  }, [user?.id, selectedConversation?.id])

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

          console.log('✅ Message belongs to current conversation - adding to UI')

          setMessages(prev => {
            // Check if message already exists (avoid duplicates)
            const exists = prev.some(m => m.id === newMessage.id)
            if (exists) {
              console.log('⚠️ Message already exists - skipping')
              return prev
            }

            // Add new message and sort by sent_at
            const updated = [...prev, newMessage].sort((a, b) =>
              new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
            )
            console.log('✅ Added message to UI, total messages:', updated.length)
            return updated
          })

          // If it's an inbound message, mark it as read after a short delay
          if (newMessage.direction === 'inbound') {
            setTimeout(async () => {
              try {
                await supabase
                  .from('messages')
                  .update({ read_at: new Date().toISOString() })
                  .eq('id', newMessage.id)
                  .is('read_at', null)
                console.log('✅ Marked message as read')

                // Update local conversation state to reflect read status
                setConversations(prev => prev.map(conv =>
                  conv.id === selectedConversation.id
                    ? { ...conv, unreadCount: 0 }
                    : conv
                ))
              } catch (error) {
                console.error('❌ Error marking message as read:', error)
              }
            }, 1000)
          }

          // Update the current conversation's last message in local state
          setConversations(prev => prev.map(conv =>
            conv.id === selectedConversation.id
              ? {
                  ...conv,
                  lastMessage: newMessage.body,
                  lastMessageAt: newMessage.sent_at
                }
              : conv
          ))
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
          const updatedMessage = payload.new as Message

          // Update the message in the current view if it's visible
          setMessages(prev => {
            const index = prev.findIndex(m => m.id === updatedMessage.id)
            if (index !== -1) {
              const updated = [...prev]
              updated[index] = updatedMessage
              return updated
            }
            return prev
          })
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
          // Only refresh if it's a meaningful update (not just last_message changes which we handle above)
          const updatedConv = payload.new as any
          setConversations(prev => prev.map(conv =>
            conv.id === selectedConversation.id
              ? {
                  ...conv,
                  // Update relevant fields that might have changed
                  smsOptInStatus: updatedConv.sms_opt_in_status,
                  optedInAt: updatedConv.opted_in_at,
                  optedOutAt: updatedConv.opted_out_at,
                }
              : conv
          ))
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

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || sending) return

    const messageText = messageInput.trim()
    const tempId = `temp-${Date.now()}`

    try {
      setSending(true)

      // Optimistically add message to UI immediately
      const optimisticMessage: Message = {
        id: tempId,
        conversation_id: selectedConversation.id,
        sender_id: user?.id || '',
        receiver_id: user?.id || '',
        body: messageText,
        direction: 'outbound',
        sent_at: new Date().toISOString(),
        status: 'sending',
        metadata: {},
      }

      setMessages(prev => [...prev, optimisticMessage])
      setMessageInput("")

      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          dealId: selectedConversation.dealId,
          message: messageText,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempId))
        throw new Error(error.error || 'Failed to send message')
      }

      // Real-time subscription will handle updating with the actual message
      // and will update conversations list via debounced refresh
    } catch (error) {
      console.error('Error sending message:', error)
      alert(error instanceof Error ? error.message : 'Failed to send message')
      setMessageInput(messageText) // Restore message input on error
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleResolveNotification = async () => {
    if (!dealDetails || resolving) return

    try {
      setResolving(true)

      const response = await fetch(`/api/deals/${dealDetails.id}/resolve-notification`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resolve notification')
      }

      // Refresh deal details to update UI and remove yellow indicator
      // Real-time subscription will handle updating conversations list
      await fetchDealDetails(dealDetails.id)

      alert('Notification resolved successfully')
    } catch (error) {
      console.error('Error resolving notification:', error)
      alert(error instanceof Error ? error.message : 'Failed to resolve notification')
    } finally {
      setResolving(false)
    }
  }

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

  const calculateNextBillingDate = (effectiveDate: string | null, billingCycle: string | null): string => {
    if (!effectiveDate || !billingCycle) return 'N/A'

    const effective = new Date(effectiveDate)
    const today = new Date()
    let nextBilling = new Date(effective)

    // Calculate the increment based on billing cycle
    const incrementMonths = {
      'monthly': 1,
      'quarterly': 3,
      'semi-annually': 6,
      'annually': 12
    }[billingCycle] || 1

    // Keep adding the billing period until we get a future date
    while (nextBilling <= today) {
      nextBilling.setMonth(nextBilling.getMonth() + incrementMonths)
    }

    return nextBilling.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex bg-background relative">
      {/* Conversations Sidebar */}
      <div
        className="bg-card border-r border-border flex flex-col"
        style={{ width: `${sidebarWidth}px`, minWidth: '250px', maxWidth: '500px' }}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">SMS Messages</h1>
            {/* Filter Dropdown */}
            <Select value={notificationFilter} onValueChange={(value: 'all' | 'lapse' | 'needs_info') => setNotificationFilter(value)}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <Filter className="h-3 w-3 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Messages</SelectItem>
                <SelectItem value="lapse">Lapse Notifications</SelectItem>
                <SelectItem value="needs_info">Needs More Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Toggle with Slider */}
          <div className="relative bg-accent/30 rounded-lg p-1 mb-4">
            <div className="grid grid-cols-2 gap-1 relative">
              {/* Animated slider background */}
              <div
                className={cn(
                  "absolute h-[calc(100%-8px)] bg-gradient-to-r from-blue-600 to-blue-500 rounded-md transition-all duration-300 ease-in-out top-1 shadow-md",
                  viewMode === 'self' ? 'left-1 right-[calc(50%+2px)]' : 'left-[calc(50%+2px)] right-1'
                )}
              />

              {/* Buttons */}
              <button
                onClick={() => setViewMode('self')}
                className={cn(
                  "relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300",
                  viewMode === 'self'
                    ? 'text-white'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Just Me
              </button>
              <button
                onClick={() => setViewMode('downlines')}
                className={cn(
                  "relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300",
                  viewMode === 'downlines'
                    ? 'text-white'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {isAdmin ? 'Everyone' : 'Downlines'}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground text-sm">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
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
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 relative">
                    <UserCircle className="h-8 w-8 text-primary" />
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
                        {formatTimestamp(conversation.lastMessageAt)}
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
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-card border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <UserCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">{selectedConversation.clientName}</h2>
                    <p className="text-sm text-muted-foreground">{selectedConversation.clientPhone}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-50">
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
                            isOutbound
                              ? "bg-blue-600 text-white"
                              : "bg-white text-gray-900 border border-gray-200"
                          )}
                        >
                          {isAutomated && (
                            <div className="text-xs opacity-75 mb-1 italic">
                              Automated message
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                          <div className="flex items-center justify-end mt-1 space-x-1">
                            <span className={cn(
                              "text-xs",
                              isOutbound ? "opacity-75" : "text-gray-500"
                            )}>
                              {formatMessageTime(message.sent_at)}
                            </span>
                            {isOutbound && (
                              <CheckCheck className={cn(
                                "h-3 w-3",
                                message.status === 'delivered' ? "opacity-100" : "opacity-50"
                              )} />
                            )}
                          </div>
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
              <div className="flex items-center space-x-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sending}
                    className="pr-10"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sending}
                  className="btn-gradient"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
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
          className="bg-card border-l border-border flex flex-col overflow-y-auto custom-scrollbar"
          style={{ width: `${rightPanelWidth}px`, minWidth: '280px', maxWidth: '600px' }}
        >
          <div className="p-5 border-b border-border sticky top-0 bg-card z-10">
            <h2 className="text-xl font-semibold text-foreground">Deal Information</h2>
          </div>

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
                      <p className="text-xs text-yellow-700 mt-1">Additional information required for this policy.</p>
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
                    value={dealDetails.policy_effective_date ? new Date(dealDetails.policy_effective_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  />
                  <DetailRow
                    label="Next Billing Date"
                    value={calculateNextBillingDate(dealDetails.policy_effective_date, dealDetails.billing_cycle)}
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
