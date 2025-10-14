"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Search,
  Mail,
  MailOpen,
  Send,
  Paperclip,
  Star,
  Archive,
  Trash2,
  Reply,
  ReplyAll,
  Forward,
  UserCircle,
  Clock,
  Circle,
  CheckCircle,
  Filter,
  Plus,
  MoreVertical,
  Flag
} from "lucide-react"

interface EmailContact {
  id: string
  name: string
  email: string
  avatar?: string
}

interface Email {
  id: string
  from: EmailContact
  to: EmailContact[]
  cc?: EmailContact[]
  bcc?: EmailContact[]
  subject: string
  body: string
  timestamp: string
  date: string
  isRead: boolean
  isStarred: boolean
  isFlagged: boolean
  hasAttachments: boolean
  labels: string[]
  folder: 'inbox' | 'sent' | 'drafts' | 'archive' | 'trash'
  priority: 'high' | 'medium' | 'low'
}

const mockContacts: EmailContact[] = [
  { id: "1", name: "John Anderson", email: "john.anderson@email.com" },
  { id: "2", name: "Sarah Williams", email: "sarah.williams@email.com" },
  { id: "3", name: "Michael Chen", email: "michael.chen@email.com" },
  { id: "4", name: "Emily Rodriguez", email: "emily.rodriguez@email.com" },
  { id: "5", name: "David Thompson", email: "david.thompson@email.com" }
]

const mockEmails: Email[] = [
  {
    id: "1",
    from: mockContacts[0],
    to: [{ id: "me", name: "Agent", email: "agent@agentspace.com" }],
    subject: "Life Insurance Policy Application Follow-up",
    body: "Hi,\n\nI wanted to follow up on my life insurance application that I submitted last week. Could you please provide an update on the status? I'm particularly interested in knowing if you need any additional documentation from me.\n\nI'm excited to move forward with this policy and would appreciate any information you can share.\n\nBest regards,\nJohn Anderson",
    timestamp: "2:30 PM",
    date: "Today",
    isRead: false,
    isStarred: true,
    isFlagged: false,
    hasAttachments: false,
    labels: ["client", "follow-up"],
    folder: "inbox",
    priority: "high"
  },
  {
    id: "2",
    from: mockContacts[1],
    to: [{ id: "me", name: "Agent", email: "agent@agentspace.com" }],
    subject: "Question about Term Life vs Whole Life Insurance",
    body: "Dear Agent,\n\nI've been researching different types of life insurance and I'm confused about the differences between term life and whole life insurance. Could you help me understand which option would be better for my situation?\n\nI'm 35 years old, married with two young children, and looking for coverage that would protect my family if something happens to me.\n\nThank you for your time.\n\nSarah Williams",
    timestamp: "11:45 AM",
    date: "Today",
    isRead: true,
    isStarred: false,
    isFlagged: true,
    hasAttachments: false,
    labels: ["consultation", "education"],
    folder: "inbox",
    priority: "medium"
  },
  {
    id: "3",
    from: { id: "me", name: "Agent", email: "agent@agentspace.com" },
    to: [mockContacts[2]],
    subject: "Your Auto Insurance Quote - Ready for Review",
    body: "Hi Michael,\n\nI've prepared your auto insurance quote based on the information you provided. The quote includes:\n\n- Comprehensive coverage\n- $500 deductible\n- Roadside assistance\n- Rental car coverage\n\nMonthly premium: $156\n\nI've attached the full quote details to this email. Please review and let me know if you have any questions or if you'd like to proceed with the application.\n\nBest regards,\nYour Insurance Agent",
    timestamp: "10:20 AM",
    date: "Today",
    isRead: true,
    isStarred: false,
    isFlagged: false,
    hasAttachments: true,
    labels: ["quote", "auto"],
    folder: "sent",
    priority: "medium"
  },
  {
    id: "4",
    from: mockContacts[3],
    to: [{ id: "me", name: "Agent", email: "agent@agentspace.com" }],
    subject: "Claim Status Update Request",
    body: "Hello,\n\nI filed a claim for my home insurance policy last month (Claim #12345) and haven't received any updates recently. Could you please check on the status and let me know what the next steps are?\n\nThe claim was for water damage in my basement.\n\nThank you,\nEmily Rodriguez",
    timestamp: "9:15 AM",
    date: "Today",
    isRead: true,
    isStarred: false,
    isFlagged: false,
    hasAttachments: false,
    labels: ["claim", "follow-up"],
    folder: "inbox",
    priority: "high"
  },
  {
    id: "5",
    from: mockContacts[4],
    to: [{ id: "me", name: "Agent", email: "agent@agentspace.com" }],
    subject: "Thank you for excellent service!",
    body: "Hi,\n\nI just wanted to take a moment to thank you for the excellent service you provided during my recent policy renewal. You made the entire process smooth and easy to understand.\n\nI'll definitely be recommending you to my friends and family.\n\nBest regards,\nDavid Thompson",
    timestamp: "4:30 PM",
    date: "Yesterday",
    isRead: true,
    isStarred: true,
    isFlagged: false,
    hasAttachments: false,
    labels: ["testimonial"],
    folder: "inbox",
    priority: "low"
  }
]

const folders = [
  { id: "inbox", name: "Inbox", icon: Mail, count: 12 },
  { id: "sent", name: "Sent", icon: Send, count: 45 },
  { id: "drafts", name: "Drafts", icon: Circle, count: 3 },
  { id: "archive", name: "Archive", icon: Archive, count: 120 },
  { id: "trash", name: "Trash", icon: Trash2, count: 8 }
]

export default function EmailCenterPage() {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(mockEmails[0])
  const [selectedFolder, setSelectedFolder] = useState("inbox")
  const [searchQuery, setSearchQuery] = useState("")
  const [isComposing, setIsComposing] = useState(false)
  const [composeData, setComposeData] = useState({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: ""
  })

  const filteredEmails = mockEmails.filter(email => {
    const matchesSearch = email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         email.from.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         email.body.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFolder = email.folder === selectedFolder
    return matchesSearch && matchesFolder
  })

  const unreadCount = mockEmails.filter(email => !email.isRead && email.folder === "inbox").length

  const handleEmailSelect = (email: Email) => {
    setSelectedEmail(email)
    if (!email.isRead) {
      // Mark as read
      email.isRead = true
    }
    setIsComposing(false)
  }

  const handleCompose = () => {
    setIsComposing(true)
    setSelectedEmail(null)
    setComposeData({
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: ""
    })
  }

  const handleSendEmail = () => {
    if (!composeData.to.trim() || !composeData.subject.trim()) return

    // In a real app, this would send the email
    alert("Email sent successfully!")
    setIsComposing(false)
    setComposeData({
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: ""
    })
  }

  const handleReply = () => {
    if (!selectedEmail) return
    setIsComposing(true)
    setComposeData({
      to: selectedEmail.from.email,
      cc: "",
      bcc: "",
      subject: `Re: ${selectedEmail.subject}`,
      body: `\n\n---\nOn ${selectedEmail.date} at ${selectedEmail.timestamp}, ${selectedEmail.from.name} wrote:\n${selectedEmail.body}`
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-500"
      case "medium": return "text-yellow-500"
      case "low": return "text-green-500"
      default: return "text-muted-foreground"
    }
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex bg-background">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">Email</h1>
            <Button size="sm" onClick={handleCompose} className="btn-gradient">
              <Plus className="h-4 w-4 mr-2" />
              Compose
            </Button>
          </div>
        </div>

        {/* Folders */}
        <div className="flex-1 p-4">
          <div className="space-y-1">
            {folders.map((folder) => {
              const FolderIcon = folder.icon
              return (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                    selectedFolder === folder.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <FolderIcon className="h-4 w-4" />
                    <span className="font-medium">{folder.name}</span>
                  </div>
                  {folder.count > 0 && (
                    <Badge
                      variant={selectedFolder === folder.id ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {folder.count}
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="w-96 bg-card border-r border-border flex flex-col">
        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
        </div>

        {/* Email List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredEmails.map((email) => (
            <div
              key={email.id}
              onClick={() => handleEmailSelect(email)}
              className={cn(
                "p-4 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors",
                selectedEmail?.id === email.id && "bg-accent",
                !email.isRead && "bg-primary/5"
              )}
            >
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <UserCircle className="h-5 w-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "font-medium truncate",
                      !email.isRead ? "font-bold" : "font-normal"
                    )}>
                      {email.from.name}
                    </span>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {email.priority === "high" && (
                        <Flag className="h-3 w-3 text-red-500" />
                      )}
                      {email.isStarred && (
                        <Star className="h-3 w-3 text-yellow-500 fill-current" />
                      )}
                      <span className="text-xs text-muted-foreground">{email.timestamp}</span>
                    </div>
                  </div>

                  <h3 className={cn(
                    "text-sm truncate mb-1",
                    !email.isRead ? "font-semibold" : "font-normal"
                  )}>
                    {email.subject}
                  </h3>

                  <p className="text-xs text-muted-foreground truncate">
                    {email.body.substring(0, 100)}...
                  </p>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex space-x-1">
                      {email.labels.map((label) => (
                        <Badge key={label} variant="outline" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center space-x-1">
                      {email.hasAttachments && (
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                      )}
                      {!email.isRead && (
                        <Circle className="h-2 w-2 text-primary fill-current" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email Content / Compose */}
      <div className="flex-1 flex flex-col">
        {isComposing ? (
          <>
            {/* Compose Header */}
            <div className="p-4 bg-card border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">New Message</h2>
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline" onClick={() => setIsComposing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSendEmail} className="btn-gradient">
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              </div>
            </div>

            {/* Compose Form */}
            <div className="flex-1 p-4 space-y-4">
              <div className="space-y-3">
                <div>
                  <Input
                    placeholder="To: recipient@email.com"
                    value={composeData.to}
                    onChange={(e) => setComposeData(prev => ({ ...prev, to: e.target.value }))}
                  />
                </div>
                <div className="flex space-x-2">
                  <Input
                    placeholder="CC:"
                    value={composeData.cc}
                    onChange={(e) => setComposeData(prev => ({ ...prev, cc: e.target.value }))}
                  />
                  <Input
                    placeholder="BCC:"
                    value={composeData.bcc}
                    onChange={(e) => setComposeData(prev => ({ ...prev, bcc: e.target.value }))}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Subject"
                    value={composeData.subject}
                    onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex-1">
                <textarea
                  placeholder="Write your message..."
                  value={composeData.body}
                  onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                  className="w-full h-96 p-3 border border-border rounded-lg resize-none bg-background text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach File
                </Button>
              </div>
            </div>
          </>
        ) : selectedEmail ? (
          <>
            {/* Email Header */}
            <div className="p-4 bg-card border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <UserCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">{selectedEmail.from.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedEmail.from.email}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline" onClick={handleReply}>
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </Button>
                  <Button size="sm" variant="ghost">
                    <ReplyAll className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Forward className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">{selectedEmail.subject}</h1>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <span>{selectedEmail.date} at {selectedEmail.timestamp}</span>
                  <Badge className={getPriorityColor(selectedEmail.priority)}>
                    {selectedEmail.priority} priority
                  </Badge>
                  {selectedEmail.hasAttachments && (
                    <div className="flex items-center space-x-1">
                      <Paperclip className="h-3 w-3" />
                      <span>Attachment</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Email Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-foreground">
                  {selectedEmail.body}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Select an email</h3>
              <p className="text-muted-foreground">Choose an email to view its content</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}