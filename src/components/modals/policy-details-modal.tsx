"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, VisuallyHidden } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { Edit, Save, X, MessageSquare, AlertCircle, Loader2, User, Phone, Calendar, DollarSign, FileText, Building2, Package, CheckCircle2, Mail, Check, Circle, Bot, Users, ChevronDown, ChevronUp } from "lucide-react"
import { cn, calculateNextCustomBillingDate, formatBillingPattern, calculateNextDraftDate } from "@/lib/utils"
import Link from "next/link"
import { useNotification } from "@/contexts/notification-context"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queryKeys'

interface PolicyDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dealId: string
  onUpdate?: () => void
  viewMode?: 'self' | 'downlines'
}

interface Message {
  id: string
  conversation_id: string
  body: string
  direction: 'inbound' | 'outbound'
  sent_at: string | null
  status: string
  metadata: any
}

interface Conversation {
  id: string
  agent_id: string
  deal_id: string
  client_phone: string | null
  last_message_at: string
  created_at: string
}

interface StatusOption {
  value: string
  label: string
}

const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('draft')) return "bg-gray-600 text-white border-gray-700";
  if (statusLower.includes('pending') || statusLower.includes('force')) return "bg-yellow-500 text-gray-900 border-yellow-600 font-semibold";
  if (statusLower.includes('verified') || statusLower.includes('approve')) return "bg-green-600 text-white border-green-700";
  if (statusLower.includes('active') || statusLower.includes('issued')) return "bg-blue-600 text-white border-blue-700";
  if (statusLower.includes('terminated') || statusLower.includes('lapsed') || statusLower.includes('cancel')) return "bg-red-600 text-white border-red-700";
  if (statusLower.includes('submit')) return "bg-purple-600 text-white border-purple-700";
  if (statusLower.includes('paid')) return "bg-emerald-600 text-white border-emerald-700";
  if (statusLower.includes('decline') || statusLower.includes('closed')) return "bg-slate-600 text-white border-slate-700";
  return "bg-slate-500 text-white border-slate-600";
}

const getClientStatusSteps = (status: string | null | undefined) => {
  const currentStatus = status || 'pre-invite'

  const steps = [
    { key: 'pre-invite', label: 'Not invited', completed: false },
    { key: 'invited', label: 'Invite sent', completed: false },
    { key: 'onboarding', label: 'Link clicked', completed: false },
    { key: 'active', label: 'Logged in', completed: false }
  ]

  // Mark steps as completed based on current status
  if (currentStatus === 'invited' || currentStatus === 'onboarding' || currentStatus === 'active') {
    steps[0].completed = true // pre-invite completed
    steps[1].completed = true // invited completed
  }

  if (currentStatus === 'onboarding' || currentStatus === 'active') {
    steps[2].completed = true // onboarding completed
  }

  if (currentStatus === 'active') {
    steps[3].completed = true // active completed
  }

  return steps
}

export function PolicyDetailsModal({ open, onOpenChange, dealId, onUpdate, viewMode = 'downlines' }: PolicyDetailsModalProps) {
  const { showSuccess, showError, showWarning, showInfo } = useNotification()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<any>(null)

  // Layout refs/state to sync right column height with left widgets
  const leftColumnRef = useRef<HTMLDivElement | null>(null)
  const [rightColumnHeight, setRightColumnHeight] = useState<number | undefined>(undefined)

  // Conversation state
  const [startConversationDialogOpen, setStartConversationDialogOpen] = useState(false)

  // Fetch deal details with TanStack Query
  const { data: dealData, isLoading: dealLoading, error: dealError, refetch: refetchDeal } = useQuery({
    queryKey: queryKeys.dealDetail(dealId),
    queryFn: async () => {
      const response = await fetch(`/api/deals/${dealId}?view=${viewMode}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch deal details')
      }

      const data = await response.json()
      return data.deal
    },
    enabled: open && !!dealId,
  })

  const deal = dealData

  // Fetch conversation with TanStack Query
  const { data: conversationData, isLoading: conversationLoading } = useQuery({
    queryKey: queryKeys.conversationDetail(dealId),
    queryFn: async () => {
      const response = await fetch(`/api/conversations/by-deal?dealId=${dealId}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch conversation')
      }

      return response.json()
    },
    enabled: open && !!dealId,
  })

  const conversation = conversationData?.conversation || null
  const existingConversation = conversationData?.existingConversation || null
  const messages = conversationData?.messages || []

  // Fetch status options with TanStack Query
  const { data: statusOptionsData } = useQuery({
    queryKey: queryKeys.dealsFilterOptions(),
    queryFn: async () => {
      const response = await fetch('/api/deals/filter-options', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch status options')
      }

      const data = await response.json()
      if (data.statuses && data.statuses.length > 0) {
        // Remove the "all" option and just use the actual statuses
        const actualStatuses = data.statuses.filter((s: StatusOption) => s.value !== 'all')
        if (actualStatuses.length > 0) {
          return actualStatuses
        }
      }
      // Return default options if none found
      return [
        { value: "draft", label: "Draft" },
        { value: "pending", label: "Pending Approval" },
        { value: "verified", label: "Verified" },
        { value: "active", label: "Active" },
        { value: "terminated", label: "Terminated" }
      ]
    },
    enabled: open, // Only fetch when modal is open
    staleTime: 5 * 60 * 1000, // 5 minutes - status options don't change often
  })

  // Ensure statusOptions is always an array
  // Handle case where statusOptionsData might be the full API response object (from cache)
  // or the processed array (from fresh query)
  const statusOptions = (() => {
    // If it's already an array, use it
    if (Array.isArray(statusOptionsData)) {
      return statusOptionsData
    }

    // If it's an object with a statuses property, extract and filter it
    if (statusOptionsData && typeof statusOptionsData === 'object' && 'statuses' in statusOptionsData) {
      const statuses = (statusOptionsData as { statuses: StatusOption[] }).statuses
      if (Array.isArray(statuses) && statuses.length > 0) {
        const filtered = statuses.filter((s: StatusOption) => s.value !== 'all')
        if (filtered.length > 0) {
          return filtered
        }
      }
    }

    // Fallback to default options
    return [
      { value: "draft", label: "Draft" },
      { value: "pending", label: "Pending Approval" },
      { value: "verified", label: "Verified" },
      { value: "active", label: "Active" },
      { value: "terminated", label: "Terminated" }
    ]
  })()

  // Beneficiaries section state
  const [beneficiariesExpanded, setBeneficiariesExpanded] = useState(false)

  // Keep the SMS card the same height as the left widgets to avoid blank space
  useEffect(() => {
    const updateHeights = () => {
      const height = leftColumnRef.current?.offsetHeight
      if (height && height !== rightColumnHeight) setRightColumnHeight(height)
    }

    // Run after paint to capture final sizes
    const id = requestAnimationFrame(updateHeights)
    window.addEventListener('resize', updateHeights)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', updateHeights)
    }
  }, [deal, isEditing, messages, conversationLoading])

  // Mutation for saving deal updates
  const saveDealMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          client_name: data.client_name,
          client_email: data.client_email,
          client_phone: data.client_phone,
          policy_effective_date: data.policy_effective_date,
          annual_premium: parseFloat(data.annual_premium),
          monthly_premium: parseFloat(data.annual_premium) / 12,
          status: data.status,
          ssn_benefit: data.ssn_benefit,
          billing_day_of_month: data.ssn_benefit ? data.billing_day_of_month : null,
          billing_weekday: data.ssn_benefit ? data.billing_weekday : null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update policy')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dealDetail(dealId) })
      setIsEditing(false)
      setEditedData(null)
      onUpdate?.()
    },
    onError: (error: Error) => {
      console.error('Error updating policy:', error)
      showError(error.message || 'Failed to update policy')
    }
  })

  // Mutation for starting conversation
  const startConversationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/conversations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dealId })
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle 409 Conflict - conversation already exists
        if (response.status === 409 && data.existingConversation) {
          return { conflict: true, data }
        }
        throw new Error(data.error || 'Failed to start conversation')
      }

      return { conflict: false, data }
    },
    onSuccess: (result) => {
      if (result.conflict) {
        setStartConversationDialogOpen(false)
        queryClient.invalidateQueries({ queryKey: queryKeys.conversationDetail(dealId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
        showInfo('A conversation with this phone number already exists. Showing existing conversation.')
      } else {
        setStartConversationDialogOpen(false)
        queryClient.invalidateQueries({ queryKey: queryKeys.conversationDetail(dealId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
      }
    },
    onError: (error: Error) => {
      console.error('Error starting conversation:', error)
      showError(error.message || 'Failed to start conversation')
    }
  })

  // Mutation for sending invite
  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      if (!deal || !deal.client_email) {
        throw new Error('Client email is required to send an invitation')
      }

      const response = await fetch(`/api/clients/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: deal.client_email,
          firstName: deal.client_name?.split(' ')[0] || 'Client',
          lastName: deal.client_name?.split(' ').slice(1).join(' ') || '',
          phoneNumber: deal.client_phone || null
        })
      })

      const data = await response.json()

      if (response.ok) {
        return { success: true, message: data.message }
      } else {
        // If client exists but not invited, try resend endpoint
        if (data.status) {
          throw new Error(`Client already has status: ${data.status}. ${data.error}`)
        } else {
          throw new Error(data.error || 'Failed to send invitation')
        }
      }
    },
    onSuccess: (data) => {
      showSuccess(data.message || 'Invitation sent successfully!')
      queryClient.invalidateQueries({ queryKey: queryKeys.dealDetail(dealId) })
    },
    onError: (error: Error) => {
      console.error('Error sending invite:', error)
      if (error.message.includes('already has status')) {
        showWarning(error.message)
      } else {
        showError(error.message || 'Failed to send invitation')
      }
    }
  })

  // Mutation for resending client invite
  const resendInviteMutation = useMutation({
    mutationFn: async () => {
      if (!deal || !deal.client_email) {
        throw new Error('Client email is required to resend invitation')
      }

      const response = await fetch('/api/clients/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: deal.client_email
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend invitation')
      }

      return data
    },
    onSuccess: (data) => {
      showSuccess(data.message || 'Invitation resent successfully!')
    },
    onError: (error: Error) => {
      console.error('Error resending invite:', error)
      showError(error.message || 'Failed to resend invitation')
    }
  })

  const handleEdit = () => {
    if (!deal) return
    setEditedData({
      client_name: deal.client_name,
      client_email: deal.client_email,
      client_phone: deal.client_phone,
      policy_effective_date: deal.policy_effective_date,
      annual_premium: deal.annual_premium,
      status: deal.status,
      ssn_benefit: deal.ssn_benefit || false,
      billing_day_of_month: deal.billing_day_of_month || null,
      billing_weekday: deal.billing_weekday || null
    })
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedData(null)
  }

  const handleSave = async () => {
    if (!deal || !editedData) return
    saveDealMutation.mutate(editedData)
  }

  const handleStartConversation = async () => {
    if (!deal) return
    startConversationMutation.mutate()
  }

  const handleSendInvite = async () => {
    if (!deal || !deal.client_email) {
      showWarning('Client email is required to send an invitation')
      return
    }
    sendInviteMutation.mutate()
  }

  const handleResendClientInvite = async () => {
    if (!deal || !deal.client_email) {
      showWarning('Client email is required to resend invitation')
      return
    }
    resendInviteMutation.mutate()
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    // Parse date as local time to avoid timezone shifts
    const [year, month, day] = dateString.split('T')[0].split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  if (!deal && dealLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <VisuallyHidden>
            <DialogTitle>Loading Policy Details</DialogTitle>
            <DialogDescription>Please wait while policy information is loaded</DialogDescription>
          </VisuallyHidden>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (dealError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <VisuallyHidden>
            <DialogTitle>Error Loading Policy</DialogTitle>
            <DialogDescription>There was an error loading the policy details</DialogDescription>
          </VisuallyHidden>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Failed to Load Policy</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {dealError instanceof Error ? dealError.message : 'An unexpected error occurred'}
            </p>
            <Button onClick={() => refetchDeal()} variant="outline">
              Try Again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!deal) return null

  const saving = saveDealMutation.isPending
  const startingConversation = startConversationMutation.isPending
  const sendingInvite = sendInviteMutation.isPending || resendInviteMutation.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto custom-scrollbar">
          <VisuallyHidden>
            <DialogTitle>Policy Details</DialogTitle>
            <DialogDescription>View and edit policy information</DialogDescription>
          </VisuallyHidden>
          {/* Hero Header */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background -mx-6 -mt-6 px-8 py-6 border-b">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <h2 className="text-3xl font-bold text-foreground">
                      {deal.carrier?.name || 'N/A'}
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      Policy #{deal.policy_number || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <Badge className={`${getStatusColor(deal.status)} border capitalize text-sm px-3 py-1`} variant="outline">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {deal.status}
                  </Badge>
                  <div className="flex items-center text-2xl font-bold text-primary">
                    <DollarSign className="h-6 w-6" />
                    {deal.annual_premium?.toFixed(2) || '0.00'}
                    <span className="text-sm text-muted-foreground font-normal ml-2">/ year</span>
                  </div>
                </div>
              </div>

              {isEditing ? (
                <div className="flex items-center gap-2 mr-8">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    variant="outline"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button onClick={handleEdit} className="btn-gradient mr-8">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Policy
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-6 mt-6 items-stretch">
            {/* Left Column - Client & Policy Info */}
            <div ref={leftColumnRef} className="col-span-3 space-y-6 min-h-0">
              {/* Client Information */}
              <Card className="professional-card border-l-4 border-l-primary">
                <CardContent className="p-6">
                  <div className="space-y-4 mb-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        <h3 className="text-xl font-bold text-foreground">Client Information</h3>
                      </div>
                      {!isEditing && deal.client_email && deal.client_status !== 'active' && (
                        <Button
                          onClick={deal.client_status === 'invited' || deal.client_status === 'onboarding' ? handleResendClientInvite : handleSendInvite}
                          disabled={sendingInvite}
                          size="sm"
                          variant={deal.client_status === 'invited' || deal.client_status === 'onboarding' ? 'outline' : 'default'}
                          className={deal.client_status === 'invited' || deal.client_status === 'onboarding' ? 'gap-1.5' : 'gap-1.5 btn-gradient'}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {sendingInvite ? 'Sending...' : (deal.client_status === 'invited' || deal.client_status === 'onboarding' ? 'Resend Invite' : 'Send Invite')}
                        </Button>
                      )}
                    </div>

                    {/* Client Status Timeline */}
                    <div className="flex items-center gap-2 py-2 px-3 bg-muted/30 rounded-lg">
                      {getClientStatusSteps(deal.client_status).map((step, index) => (
                        <div key={step.key} className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            {step.completed ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-gray-400" />
                            )}
                            <span className={cn(
                              "text-xs font-medium",
                              step.completed ? "text-green-600" : "text-muted-foreground"
                            )}>
                              {step.label}
                            </span>
                          </div>
                          {index < getClientStatusSteps(deal.client_status).length - 1 && (
                            <div className={cn(
                              "h-px w-4",
                              step.completed ? "bg-green-600" : "bg-gray-300"
                            )} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Name</label>
                      {isEditing ? (
                        <Input
                          type="text"
                          value={editedData?.client_name || ''}
                          onChange={(e) => setEditedData({ ...editedData, client_name: e.target.value })}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-lg font-semibold text-foreground">{deal.client_name}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        Client Email
                      </label>
                      {isEditing ? (
                        <Input
                          type="email"
                          value={editedData?.client_email || ''}
                          onChange={(e) => setEditedData({ ...editedData, client_email: e.target.value })}
                          className="mt-1"
                          placeholder="client@example.com"
                        />
                      ) : (
                        <p className="text-lg font-semibold text-foreground">{deal.client_email || 'N/A'}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Client Phone
                      </label>
                      {isEditing ? (
                        deal.phone_hidden ? (
                          <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                            Hidden
                          </Badge>
                        ) : (
                          <Input
                            type="text"
                            value={editedData?.client_phone || ''}
                            onChange={(e) => setEditedData({ ...editedData, client_phone: e.target.value })}
                            className="mt-1"
                          />
                        )
                      ) : deal.phone_hidden ? (
                        <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                          Hidden
                        </Badge>
                      ) : (
                        <p className="text-lg font-semibold text-foreground">{deal.client_phone || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Policy Details */}
              <Card className="professional-card border-l-4 border-l-blue-500">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <h3 className="text-xl font-bold text-foreground">Policy Details</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Effective Date
                      </label>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editedData?.policy_effective_date || ''}
                          onChange={(e) => setEditedData({ ...editedData, policy_effective_date: e.target.value })}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-lg font-semibold text-foreground">{formatDate(deal.policy_effective_date)}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Annual Premium
                      </label>
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editedData?.annual_premium || ''}
                          onChange={(e) => setEditedData({ ...editedData, annual_premium: e.target.value })}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-lg font-bold text-primary">${deal.annual_premium?.toFixed(2) || '0.00'}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        Carrier
                      </label>
                      <p className="text-lg font-semibold text-foreground">{deal.carrier?.name || 'N/A'}</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Product
                      </label>
                      <p className="text-lg font-semibold text-foreground">{deal.product?.name || 'N/A'}</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Status
                      </label>
                      {isEditing ? (
                        <SimpleSearchableSelect
                          options={statusOptions}
                          value={editedData?.status || ''}
                          onValueChange={(value) => setEditedData({ ...editedData, status: value })}
                          placeholder="Select Status"
                          searchPlaceholder="Search status..."
                          portal={true}
                        />
                      ) : (
                        <div>
                          <Badge className={`${getStatusColor(deal.status)} border capitalize`} variant="outline">
                            {deal.status}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Writing Agent
                      </label>
                      <p className="text-lg font-semibold text-foreground">
                        {deal.agent ? `${deal.agent.first_name} ${deal.agent.last_name}` : 'N/A'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Next Billing Date
                      </label>
                      {deal.ssn_benefit && deal.billing_day_of_month && deal.billing_weekday ? (
                        <div>
                          <p className="text-lg font-semibold text-foreground">
                            {(() => {
                              const nextBilling = calculateNextCustomBillingDate(deal.billing_day_of_month, deal.billing_weekday)
                              return nextBilling ? nextBilling.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'
                            })()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatBillingPattern(deal.billing_day_of_month, deal.billing_weekday)} of each month
                          </p>
                        </div>
                      ) : deal.policy_effective_date && deal.billing_cycle ? (
                        <p className="text-lg font-semibold text-foreground">
                          {(() => {
                            const nextDraft = calculateNextDraftDate(deal.policy_effective_date, deal.billing_cycle)
                            return nextDraft ? nextDraft.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'
                          })()}
                        </p>
                      ) : (
                        <p className="text-lg font-semibold text-muted-foreground">N/A</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Date of Birth
                      </label>
                      <p className="text-lg font-semibold text-foreground">
                        {deal.date_of_birth ? formatDate(deal.date_of_birth) : 'N/A'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Coverage Amount
                      </label>
                      <p className="text-lg font-semibold text-foreground">
                        {deal.face_value ? `$${Number(deal.face_value).toLocaleString()}` : 'N/A'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Rate Class
                      </label>
                      <p className="text-lg font-semibold text-foreground">
                        {deal.rate_class || 'N/A'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Monthly Premium
                      </label>
                      <p className="text-lg font-semibold text-foreground">
                        {deal.monthly_premium ? `$${Number(deal.monthly_premium).toFixed(2)}` : 'N/A'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Lead Source
                      </label>
                      <p className="text-lg font-semibold text-foreground capitalize">
                        {deal.lead_source || 'N/A'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Team
                      </label>
                      <p className="text-lg font-semibold text-foreground">
                        {deal.team || 'N/A'}
                      </p>
                    </div>

                    {deal.notes && (
                      <div className="space-y-1 col-span-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Notes
                        </label>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {deal.notes}
                        </p>
                      </div>
                    )}

                    {isEditing && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            SSN Benefit
                          </label>
                          <SimpleSearchableSelect
                            options={[
                              { value: 'yes', label: 'Yes' },
                              { value: 'no', label: 'No' }
                            ]}
                            value={editedData?.ssn_benefit ? 'yes' : 'no'}
                            onValueChange={(value) => setEditedData({
                              ...editedData,
                              ssn_benefit: value === 'yes',
                              billing_day_of_month: value === 'no' ? null : editedData?.billing_day_of_month,
                              billing_weekday: value === 'no' ? null : editedData?.billing_weekday
                            })}
                            placeholder="Select..."
                            searchPlaceholder="Search..."
                            portal={true}
                          />
                        </div>

                        {editedData?.ssn_benefit && (
                          <>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Billing Week
                              </label>
                              <SimpleSearchableSelect
                                options={[
                                  { value: '1st', label: '1st' },
                                  { value: '2nd', label: '2nd' },
                                  { value: '3rd', label: '3rd' },
                                  { value: '4th', label: '4th' }
                                ]}
                                value={editedData?.billing_day_of_month || ''}
                                onValueChange={(value) => setEditedData({ ...editedData, billing_day_of_month: value })}
                                placeholder="Select week..."
                                searchPlaceholder="Search..."
                                portal={true}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Billing Day
                              </label>
                              <SimpleSearchableSelect
                                options={[
                                  { value: 'Monday', label: 'Monday' },
                                  { value: 'Tuesday', label: 'Tuesday' },
                                  { value: 'Wednesday', label: 'Wednesday' },
                                  { value: 'Thursday', label: 'Thursday' },
                                  { value: 'Friday', label: 'Friday' }
                                ]}
                                value={editedData?.billing_weekday || ''}
                                onValueChange={(value) => setEditedData({ ...editedData, billing_weekday: value })}
                                placeholder="Select day..."
                                searchPlaceholder="Search..."
                                portal={true}
                              />
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Beneficiaries Section */}
              {deal.beneficiaries && deal.beneficiaries.length > 0 && (
                <Card className="professional-card border-l-4 border-l-purple-500">
                  <CardContent className="p-6">
                    <button
                      onClick={() => setBeneficiariesExpanded(!beneficiariesExpanded)}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-purple-500" />
                        <h3 className="text-xl font-bold text-foreground">Beneficiaries</h3>
                        <Badge variant="secondary" className="ml-2">{deal.beneficiaries.length}</Badge>
                      </div>
                      {beneficiariesExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    {beneficiariesExpanded && (
                      <div className="mt-4 space-y-3">
                        {deal.beneficiaries.map((beneficiary: { id: string; first_name: string; last_name: string; relationship: string }) => (
                          <div key={beneficiary.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
                                <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">
                                  {beneficiary.first_name} {beneficiary.last_name}
                                </p>
                                {beneficiary.relationship && (
                                  <p className="text-sm text-muted-foreground capitalize">
                                    {beneficiary.relationship}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - SMS Conversation */}
            <div className="col-span-2 min-h-0">

            {/* SMS Conversation Section */}
            <Card className="professional-card border-l-4 border-l-emerald-500 flex flex-col h-full" style={{ height: rightColumnHeight ? rightColumnHeight : undefined }}>
              <CardContent className="p-6 flex flex-col h-full min-h-0">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-xl font-bold text-foreground">SMS Conversation</h3>
                </div>

                {conversationLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : conversation || existingConversation ? (
                  <div className="space-y-3 flex-1 flex flex-col min-h-0">
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Active since {new Date((conversation || existingConversation)!.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>

                    {messages.length > 0 ? (
                      <div className="flex-1 flex flex-col min-h-0">
                        <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
                          {messages.map((message: Message) => {
                            const isOutbound = message.direction === 'outbound'
                            const isAutomated = message.metadata?.automated
                            const isDraft = message.status === 'draft'

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
                                    "max-w-[85%] rounded-lg px-3 py-1.5 shadow-sm",
                                    isDraft
                                      ? "bg-yellow-100 text-gray-900 border-2 border-yellow-400"
                                      : isOutbound
                                      ? "bg-blue-600 text-white"
                                      : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                                  )}
                                >
                                  {isDraft && (
                                    <div className="text-xs font-semibold mb-1 text-yellow-800 flex items-center gap-1">
                                      <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full"></span>
                                      DRAFT - Pending Approval
                                    </div>
                                  )}
                                  {isAutomated && !isDraft && (
                                    <div className="text-xs opacity-75 mb-0.5 italic font-medium flex items-center gap-1">
                                      <Bot className="h-3 w-3" />
                                      Automated
                                    </div>
                                  )}
                                  <p className="text-sm whitespace-pre-wrap break-words leading-snug">{message.body}</p>
                                  {!isDraft && (
                                    <div className="flex items-center justify-end mt-0.5">
                                      <span className={cn(
                                        "text-xs",
                                        isOutbound ? "opacity-75" : "text-gray-500"
                                      )}>
                                        {message.sent_at ? formatMessageTime(message.sent_at) : 'Pending'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <Link href={`/communications/sms?conversation=${(conversation || existingConversation)!.id}`}>
                            <Button variant="outline" size="sm" className="w-full">
                              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                              Open Full Conversation →
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>No messages yet</p>
                        <div className="mt-4">
                          <Link href={`/communications/sms?conversation=${(conversation || existingConversation)!.id}`}>
                            <Button variant="outline" size="sm">
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Start Messaging →
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    {deal.client_phone ? (
                      existingConversation ? (
                        <div>
                          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                          </div>
                          <p className="text-foreground font-semibold mb-2">
                            Conversation already exists
                          </p>
                          <p className="text-muted-foreground text-sm mb-6">
                            A conversation with this client already exists for another policy
                          </p>
                          <Link href={`/communications/sms?conversation=${(existingConversation as Conversation).id}`}>
                            <Button variant="outline" className="w-full">
                              <MessageSquare className="h-4 w-4 mr-2" />
                              View Existing Conversation →
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <div>
                          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageSquare className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <p className="text-foreground font-semibold mb-2">
                            No conversation yet
                          </p>
                          <p className="text-muted-foreground text-sm mb-6">
                            Start messaging this client
                          </p>
                          <Button
                            onClick={() => setStartConversationDialogOpen(true)}
                            className="btn-gradient w-full"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Start Conversation
                          </Button>
                        </div>
                      )
                    ) : (
                      <div>
                        <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertCircle className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <p className="text-foreground font-semibold mb-2">
                          No phone number
                        </p>
                        <p className="text-muted-foreground text-sm">
                          Add a phone number in edit mode to start messaging
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Start Conversation Confirmation Dialog */}
      <Dialog open={startConversationDialogOpen} onOpenChange={setStartConversationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <DialogTitle>Start SMS Conversation</DialogTitle>
            </div>
            <DialogDescription>
              Starting a conversation will automatically send a welcome message to the client.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-accent/30 rounded-lg border border-border">
              <p className="text-sm font-medium text-foreground mb-2">Welcome Message Preview:</p>
              <p className="text-sm text-muted-foreground italic">
                "Thanks for your policy with [Agency Name]. You'll receive policy updates and reminders by text.
                Message frequency may vary. Msg&data rates may apply.
                Reply STOP to opt out. Reply HELP for help."
              </p>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Client Phone: <span className="font-semibold text-foreground">{deal.client_phone}</span>
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setStartConversationDialogOpen(false)}
              disabled={startingConversation}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartConversation}
              disabled={startingConversation}
              className="btn-gradient"
            >
              {startingConversation ? 'Starting...' : 'Send Welcome & Start'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
