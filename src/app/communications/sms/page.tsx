"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Search,
  Phone,
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  UserCircle,
  Clock,
  CheckCheck,
  ArrowLeft
} from "lucide-react"

interface Contact {
  id: string
  name: string
  phone: string
  avatar?: string
  lastMessage?: string
  lastMessageTime?: string
  unreadCount?: number
  isOnline?: boolean
}

interface Message {
  id: string
  content: string
  timestamp: string
  isSent: boolean
  isRead?: boolean
  type: 'text' | 'image' | 'file'
}

const mockContacts: Contact[] = [
  {
    id: "1",
    name: "John Anderson",
    phone: "(555) 123-4567",
    lastMessage: "Thanks for the policy details!",
    lastMessageTime: "2 min ago",
    unreadCount: 2,
    isOnline: true
  },
  {
    id: "2",
    name: "Sarah Williams",
    phone: "(555) 234-5678",
    lastMessage: "When can we schedule a call?",
    lastMessageTime: "1 hour ago",
    unreadCount: 0,
    isOnline: false
  },
  {
    id: "3",
    name: "Michael Chen",
    phone: "(555) 345-6789",
    lastMessage: "Perfect, I'll review the documents",
    lastMessageTime: "3 hours ago",
    unreadCount: 1,
    isOnline: true
  },
  {
    id: "4",
    name: "Emily Rodriguez",
    phone: "(555) 456-7890",
    lastMessage: "Thank you for your help!",
    lastMessageTime: "Yesterday",
    unreadCount: 0,
    isOnline: false
  },
  {
    id: "5",
    name: "David Thompson",
    phone: "(555) 567-8901",
    lastMessage: "I have a few questions about...",
    lastMessageTime: "2 days ago",
    unreadCount: 0,
    isOnline: true
  }
]

const mockMessages: { [key: string]: Message[] } = {
  "1": [
    {
      id: "1",
      content: "Hi! I wanted to follow up on my life insurance application.",
      timestamp: "10:30 AM",
      isSent: false,
      isRead: true,
      type: 'text'
    },
    {
      id: "2",
      content: "Hello John! I've reviewed your application and everything looks good. Let me send you the policy details.",
      timestamp: "10:32 AM",
      isSent: true,
      isRead: true,
      type: 'text'
    },
    {
      id: "3",
      content: "Thanks for the policy details!",
      timestamp: "10:35 AM",
      isSent: false,
      isRead: true,
      type: 'text'
    }
  ],
  "2": [
    {
      id: "1",
      content: "Hi Sarah! I hope you're doing well. I wanted to discuss your insurance options.",
      timestamp: "9:15 AM",
      isSent: true,
      isRead: true,
      type: 'text'
    },
    {
      id: "2",
      content: "When can we schedule a call?",
      timestamp: "11:20 AM",
      isSent: false,
      isRead: true,
      type: 'text'
    }
  ]
}

export default function SMSMessagingPage() {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(mockContacts[0])
  const [searchQuery, setSearchQuery] = useState("")
  const [messageInput, setMessageInput] = useState("")
  const [messages, setMessages] = useState<Message[]>(mockMessages["1"] || [])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const filteredContacts = mockContacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone.includes(searchQuery)
  )

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact)
    setMessages(mockMessages[contact.id] || [])
  }

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedContact) return

    const newMessage: Message = {
      id: Date.now().toString(),
      content: messageInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSent: true,
      isRead: false,
      type: 'text'
    }

    setMessages(prev => [...prev, newMessage])
    setMessageInput("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const initiateCall = () => {
    if (selectedContact) {
      // This would integrate with your calling system
      alert(`Initiating call to ${selectedContact.name} at ${selectedContact.phone}`)
    }
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex bg-background">
      {/* Contacts Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">Messages</h1>
            <Button size="sm" variant="outline" className="btn-gradient">
              New Chat
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => handleContactSelect(contact)}
              className={cn(
                "p-4 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors",
                selectedContact?.id === contact.id && "bg-accent"
              )}
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                    <UserCircle className="h-8 w-8 text-primary" />
                  </div>
                  {contact.isOnline && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-card" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-foreground truncate">{contact.name}</h3>
                    <span className="text-xs text-muted-foreground">{contact.lastMessageTime}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-muted-foreground truncate">{contact.lastMessage}</p>
                    {contact.unreadCount && contact.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{contact.phone}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-card border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      <UserCircle className="h-6 w-6 text-primary" />
                    </div>
                    {selectedContact.isOnline && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">{selectedContact.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedContact.phone}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={initiateCall}
                    className="btn-gradient"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                  <Button size="sm" variant="ghost">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.isSent ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "chat-bubble",
                      message.isSent ? "sent" : "received"
                    )}
                  >
                    <p className="text-sm">{message.content}</p>
                    <div className="flex items-center justify-end mt-1 space-x-1">
                      <span className="text-xs opacity-70">{message.timestamp}</span>
                      {message.isSent && (
                        <CheckCheck className={cn(
                          "h-3 w-3",
                          message.isRead ? "text-primary" : "opacity-50"
                        )} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-card border-t border-border">
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="ghost">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pr-10"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="btn-gradient"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Select a conversation</h3>
              <p className="text-muted-foreground">Choose a contact to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}