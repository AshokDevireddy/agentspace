"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, VisuallyHidden } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { AsyncSearchableSelect } from "@/components/ui/async-searchable-select"
import { Loader2, User, Calendar, DollarSign, Users, Building2, Mail, Phone, CheckCircle2, UserCog, TrendingUp, Circle, X, Edit, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useNotification } from "@/contexts/notification-context"
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queryKeys'
import { useSaveAgent } from '@/hooks/mutations'

interface AgentDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  onUpdate?: () => void
  startMonth?: string
  endMonth?: string
}

const badgeColors: { [key: string]: string } = {
  "Legacy Junior Partner": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Karma Director 2": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Karma Director 1": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Legacy MGA": "bg-green-500/20 text-green-400 border-green-500/30",
  "Legacy GA": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Legacy SA": "bg-red-500/20 text-red-400 border-red-500/30",
}

const statusColors: { [key: string]: string } = {
  "pre-invite": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "invited": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "onboarding": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "active": "bg-green-500/20 text-green-400 border-green-500/30",
  "inactive": "bg-red-500/20 text-red-400 border-red-500/30",
}

// Position colors based on hierarchy level (top 10 positions get distinct colors, rest are gray)
const positionLevelColors: string[] = [
  "bg-amber-500/20 text-amber-400 border-amber-500/30",      // Level 1 (highest) - Gold
  "bg-orange-500/20 text-orange-400 border-orange-500/30",   // Level 2 - Orange
  "bg-blue-500/20 text-blue-400 border-blue-500/30",         // Level 3 - Blue
  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",         // Level 4 - Cyan
  "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",   // Level 5 - Indigo
  "bg-purple-500/20 text-purple-400 border-purple-500/30",   // Level 6 - Purple
  "bg-violet-500/20 text-violet-400 border-violet-500/30",   // Level 7 - Violet
  "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30", // Level 8 - Fuchsia
  "bg-pink-500/20 text-pink-400 border-pink-500/30",         // Level 9 - Pink
  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", // Level 10 - Emerald
]

const getPositionColorByLevel = (positionLevel: number | null | undefined, colorMap: Map<number, string>): string => {
  if (positionLevel === null || positionLevel === undefined) {
    return "bg-slate-500/20 text-slate-400 border-slate-500/30"
  }

  // Get color from the map (which is populated based on agency's position ranking)
  return colorMap.get(positionLevel) || "bg-gray-500/20 text-gray-400 border-gray-500/30"
}

const getAgentStatusSteps = (status: string | null | undefined) => {
  const currentStatus = (status || 'pre-invite').toLowerCase()

  const capitalizeStatus = (status: string) => {
    return status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('-')
  }

  const steps = [
    { key: 'pre-invite', label: capitalizeStatus('pre-invite'), completed: false, isCurrent: false },
    { key: 'invited', label: capitalizeStatus('invited'), completed: false, isCurrent: false },
    { key: 'onboarding', label: capitalizeStatus('onboarding'), completed: false, isCurrent: false },
    { key: 'active', label: capitalizeStatus('active'), completed: false, isCurrent: false }
  ]

  // Find current status index
  const currentIndex = steps.findIndex(step => step.key === currentStatus)
  
  // Mark all steps up to and including current status as completed
  if (currentIndex >= 0) {
    for (let i = 0; i <= currentIndex; i++) {
      steps[i].completed = true
    }
    // Mark current status
    if (currentIndex >= 0) {
      steps[currentIndex].isCurrent = true
    }
  }

  return steps
}

export function AgentDetailsModal({ open, onOpenChange, agentId, onUpdate, startMonth, endMonth }: AgentDetailsModalProps) {
  const { showSuccess, showError } = useNotification()
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<any>(null)

  // Save mutation hook for both update and invite flows
  const saveMutation = useSaveAgent({
    onSuccess: (data) => {
      setIsEditing(false)
      setEditedData(null)

      if (data.type === 'invite') {
        showSuccess('Invitation sent successfully!')
      } else {
        showSuccess('Agent updated successfully!')
      }

      // Close the modal after successful save
      onOpenChange(false)
      // Trigger any update callbacks
      onUpdate?.()
    },
    onError: (err) => {
      console.error('Error saving agent:', err)
      showError(err.message || 'Failed to save agent')
    },
  })

  // Fetch positions for color map
  const { data: positionColorMap = new Map<number, string>() } = useQuery({
    queryKey: queryKeys.positionsList(),
    queryFn: async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) return new Map<number, string>()

      // Fetch all positions for the agency
      const response = await fetch('/api/positions', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        return new Map<number, string>()
      }

      const data = await response.json()

      // API now returns an object with positions array
      // Fallback to array check for backwards compatibility
      const positions = data.positions || (Array.isArray(data) ? data : [])

      // Sort positions by level (descending - highest level first)
      const sortedPositions = [...positions].sort((a: any, b: any) => b.level - a.level)

      // Create a map of level -> color based on rank
      const colorMap = new Map<number, string>()
      sortedPositions.forEach((position: any, index: number) => {
        // Top 10 positions get distinct colors, rest get gray
        if (index < 10) {
          colorMap.set(position.level, positionLevelColors[index])
        } else {
          colorMap.set(position.level, "bg-gray-500/20 text-gray-400 border-gray-500/30")
        }
      })

      console.log('[AgentDetailsModal] Position color map created:', colorMap)
      return colorMap
    },
    enabled: open,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Check admin status
  const { data: isAdmin = false } = useQuery({
    queryKey: queryKeys.userAdminStatus(),
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return false

      const { data: userData } = await supabase
        .from('users')
        .select('is_admin, perm_level, role')
        .eq('auth_user_id', user.id)
        .single()

      // Check all three admin indicators: is_admin, perm_level, and role
      return userData?.is_admin ||
             userData?.perm_level === 'admin' ||
             userData?.role === 'admin'
    },
    enabled: open,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Check if current user can edit this agent (admin or agent is in their downline)
  const { data: canEditAgent = false } = useQuery({
    queryKey: ['can-edit-agent', agentId],
    queryFn: async () => {
      // If no agentId, can't edit
      if (!agentId) return false

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return false

      // Get current user's info (including admin status and ID)
      const { data: userData } = await supabase
        .from('users')
        .select('id, is_admin, perm_level, role')
        .eq('auth_user_id', user.id)
        .single()

      if (!userData?.id) return false

      // Check if user is admin
      const userIsAdmin = userData.is_admin ||
        userData.perm_level === 'admin' ||
        userData.role === 'admin'

      // If admin, can always edit
      if (userIsAdmin) return true

      // Get all downlines for the current user
      const { data: downlines, error } = await supabase
        .rpc('get_agent_downline', {
          agent_id: userData.id,
        })

      if (error) {
        console.error('Error fetching downlines for edit check:', error)
        return false
      }

      // Check if the agent being viewed is in the downline tree
      const downlineIds = (downlines as any[])?.map((d: any) => d.id) || []
      return downlineIds.includes(agentId)
    },
    enabled: open && !!agentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch agent details
  const { data: agent, isLoading: loading, error: agentError, refetch: refetchAgent } = useQuery({
    queryKey: [...queryKeys.agentDetail(agentId), startMonth, endMonth],
    queryFn: async () => {
      // Build URL with optional date range parameters
      const url = new URL(`/api/agents/${agentId}`, window.location.origin)
      if (startMonth) url.searchParams.set('startMonth', startMonth)
      if (endMonth) url.searchParams.set('endMonth', endMonth)

      const response = await fetch(url.toString(), {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch agent details')
      }

      const data = await response.json()
      console.log('[AgentDetailsModal] Raw API response:', data)
      // Convert name format from "Last, First" to "First Last" if needed
      // Also normalize status to lowercase for consistency
      const transformedData = {
        ...data,
        name: data.name?.includes(',')
          ? data.name.split(',').reverse().map((s: string) => s.trim()).join(' ')
          : data.name,
        status: data.status?.toLowerCase() || 'active',
        is_active: data.is_active ?? true // Ensure is_active is preserved
      }
      console.log('[AgentDetailsModal] Transformed agent data:', transformedData)
      return transformedData
    },
    enabled: open && !!agentId,
    staleTime: 30 * 1000, // 30 seconds
  })

  // Fetch downlines
  const { data: downlines = [], isLoading: loadingDownlines } = useQuery({
    queryKey: queryKeys.agentDownlines(agentId),
    queryFn: async () => {
      const response = await fetch(`/api/agents/downlines?agentId=${agentId}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch downlines')
      }

      const data = await response.json()
      return data.downlines || []
    },
    enabled: open && !!agentId,
    staleTime: 30 * 1000, // 30 seconds
  })

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return 'N/A'
    }
  }

  const handleEdit = () => {
    if (!agent) return
    console.log('[AgentDetailsModal] Agent object when editing:', agent)
    console.log('[AgentDetailsModal] Agent is_active value:', agent.is_active)
    setEditedData({
      email: agent.email || '',
      phone_number: agent.phone_number || '',
      role: agent.role || '',
      status: agent.status || 'pre-invite',
      upline_id: agent.upline_id || '',
      is_active: agent.is_active !== undefined ? agent.is_active : true
    })
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedData(null)
  }

  const handleSave = () => {
    if (!agent || !editedData) return

    console.log('[AgentDetailsModal] Saving with editedData:', editedData)
    console.log('[AgentDetailsModal] is_active in editedData:', editedData.is_active)

    // Check if we should send an invite automatically
    const wasPreInvite = agent.status?.toLowerCase() === 'pre-invite'
    const hasEmail = editedData.email && editedData.email.trim() !== ''
    const emailChanged = editedData.email !== agent.email
    const shouldSendInvite = wasPreInvite && hasEmail && emailChanged

    saveMutation.mutate({
      agentId: agent.id,
      agentName: agent.name,
      editedData,
      positionId: agent.position_id,
      shouldSendInvite,
    })
  }

  if (loading || (!agent && !agentError)) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <VisuallyHidden>
            <DialogTitle>Loading Agent Details</DialogTitle>
            <DialogDescription>Please wait while agent information is loaded</DialogDescription>
          </VisuallyHidden>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (agentError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <VisuallyHidden>
            <DialogTitle>Error Loading Agent</DialogTitle>
            <DialogDescription>There was an error loading the agent details</DialogDescription>
          </VisuallyHidden>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <X className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Failed to Load Agent</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {agentError instanceof Error ? agentError.message : 'An unexpected error occurred'}
            </p>
            <Button onClick={() => refetchAgent()} variant="outline">
              Try Again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!agent) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto custom-scrollbar">
        <VisuallyHidden>
          <DialogTitle>Agent Details</DialogTitle>
          <DialogDescription>View agent information and statistics</DialogDescription>
        </VisuallyHidden>
        
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background -mx-6 -mt-6 px-8 py-6 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-12 h-12 rounded-full ${badgeColors[agent.badge] || 'bg-muted text-muted-foreground'} flex items-center justify-center text-lg font-bold border`}>
                  {agent.badge?.charAt(0) || agent.name?.charAt(0) || 'A'}
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-foreground">
                    {agent.name}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                {/* Show position badge if available */}
                {agent.position && (
                  <Badge
                    className={`${getPositionColorByLevel(agent.position_level, positionColorMap)} border text-sm px-3 py-1 font-semibold`}
                    variant="outline"
                  >
                    <UserCog className="h-3 w-3 mr-1" />
                    {agent.position}
                  </Badge>
                )}
                {/* Show role badge (Admin/Agent) */}
                <Badge
                  className={`${
                    agent.badge?.toLowerCase().includes('admin')
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      : 'bg-green-500/20 text-green-400 border-green-500/30'
                  } border text-sm px-3 py-1 font-semibold`}
                  variant="outline"
                >
                  <UserCog className="h-3 w-3 mr-1" />
                  {agent.badge?.toLowerCase().includes('admin') ? 'Admin' : 'Agent'}
                </Badge>
                <Badge
                  className={`border ${statusColors[agent.status?.toLowerCase()] || 'bg-muted text-muted-foreground border-border'} text-sm px-3 py-1`}
                  variant="outline"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {agent.status ? agent.status.charAt(0).toUpperCase() + agent.status.slice(1).replace('-', ' ') : 'Active'}
                </Badge>
                {agent.downlines > 0 && (
                  <div className="flex items-center text-lg font-semibold text-primary">
                    <Users className="h-5 w-5 mr-1" />
                    {agent.downlines} {agent.downlines === 1 ? 'Downline' : 'Downlines'}
                  </div>
                )}
              </div>
            </div>

            {canEditAgent && (
              isEditing ? (
                <div className="flex items-center gap-2 mr-8">
                  <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    disabled={saveMutation.isPending}
                    variant="outline"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button onClick={handleEdit} className="btn-gradient mr-8">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Agent
                </Button>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 mt-6">
          {/* Agent Information */}
          <Card className="professional-card border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <User className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold text-foreground">Agent Information</h3>
              </div>
              
              {/* Status Progress Bar */}
              {agent.status && ['pre-invite', 'invited', 'onboarding', 'active'].includes(agent.status.toLowerCase()) ? (
                <div className="flex items-center gap-2 py-2 px-3 bg-muted/30 rounded-lg mb-6">
                  {getAgentStatusSteps(agent.status).map((step, index) => (
                    <div key={step.key} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        {step.isCurrent ? (
                          <div className="h-3.5 w-3.5 rounded-full bg-green-600 flex items-center justify-center">
                            <div className="h-2 w-2 bg-white rounded-full" />
                          </div>
                        ) : step.completed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-gray-400" />
                        )}
                        <span className={cn(
                          "text-xs font-medium",
                          step.isCurrent ? "text-green-600 font-semibold" : step.completed ? "text-green-600" : "text-muted-foreground"
                        )}>
                          {step.label}
                        </span>
                      </div>
                      {index < getAgentStatusSteps(agent.status).length - 1 && (
                        <div className={cn(
                          "h-px w-4",
                          step.completed ? "bg-green-600" : "bg-gray-300"
                        )} />
                      )}
                    </div>
                  ))}
                </div>
              ) : agent.status?.toLowerCase() === 'inactive' ? (
                <div className="flex items-center gap-2 py-2 px-3 bg-red-500/20 border border-red-500/30 rounded-lg mb-6">
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full border-2 border-red-600 flex items-center justify-center">
                      <X className="h-3.5 w-3.5 text-red-600" />
                    </div>
                    <span className="text-xs font-medium text-red-600">
                      Inactive
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email
                  </label>
                  {isEditing ? (
                    <Input
                      type="email"
                      value={editedData?.email || ''}
                      onChange={(e) => setEditedData({ ...editedData, email: e.target.value })}
                      className="mt-1"
                      placeholder="agent@example.com"
                    />
                  ) : (
                    <p className="text-lg font-semibold text-foreground">{agent.email || 'N/A'}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Phone Number
                  </label>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={editedData?.phone_number || ''}
                      onChange={(e) => setEditedData({ ...editedData, phone_number: e.target.value })}
                      className="mt-1"
                      placeholder="(555) 123-4567"
                    />
                  ) : (
                    <p className="text-lg font-semibold text-foreground">{agent.phone_number || 'N/A'}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</label>
                  {isEditing ? (
                    <SimpleSearchableSelect
                      options={[
                        { value: 'agent', label: 'Agent' },
                        { value: 'admin', label: 'Admin' },
                        { value: 'client', label: 'Client' }
                      ]}
                      value={editedData?.role || ''}
                      onValueChange={(value) => setEditedData({ ...editedData, role: value })}
                      placeholder="Select role..."
                      searchPlaceholder="Search roles..."
                    />
                  ) : (
                    <p className="text-lg font-semibold text-foreground">{agent.role ? agent.role.charAt(0).toUpperCase() + agent.role.slice(1) : 'N/A'}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Position</label>
                  {agent.position ? (
                    <Badge
                      className={`${getPositionColorByLevel(agent.position_level, positionColorMap)} border font-semibold text-sm mt-1`}
                      variant="outline"
                    >
                      {agent.position}
                    </Badge>
                  ) : (
                    <p className="text-lg font-semibold text-muted-foreground italic">Not Set</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created
                  </label>
                  <p className="text-lg font-semibold text-foreground">{formatDate(agent.created)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Last Login
                  </label>
                  <p className="text-lg font-semibold text-foreground">{agent.lastLogin || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upline</label>
                  {isEditing ? (
                    <AsyncSearchableSelect
                      value={editedData?.upline_id || 'all'}
                      onValueChange={(value) => setEditedData({ ...editedData, upline_id: value })}
                      placeholder="Select upline..."
                      searchPlaceholder="Type to search agents..."
                      searchEndpoint="/api/search-agents?format=options&type=downline"
                      defaultLabel={agent.upline || 'None'}
                    />
                  ) : (
                    <p className="text-lg font-semibold text-foreground">{agent.upline || 'None'}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Downlines Count
                  </label>
                  <p className="text-lg font-semibold text-foreground">{agent.downlines || 0}</p>
                </div>
                {isEditing && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Status
                      </label>
                      <SimpleSearchableSelect
                        options={[
                          { value: 'pre-invite', label: 'Pre-Invite' },
                          { value: 'invited', label: 'Invited' },
                          { value: 'onboarding', label: 'Onboarding' },
                          { value: 'active', label: 'Active' },
                          { value: 'inactive', label: 'Inactive' }
                        ]}
                        value={editedData?.status || ''}
                        onValueChange={(value) => setEditedData({ ...editedData, status: value })}
                        placeholder="Select status..."
                        searchPlaceholder="Search status..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Active Status
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <Checkbox
                          id="is_active"
                          checked={editedData?.is_active ?? true}
                          onCheckedChange={(checked) => setEditedData({ ...editedData, is_active: checked as boolean })}
                        />
                        <label htmlFor="is_active" className="text-sm font-medium text-foreground cursor-pointer">
                          Agent is active
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card className="professional-card border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <h3 className="text-xl font-bold text-foreground">Performance Metrics</h3>
                </div>
                <div className="text-xs text-muted-foreground">
                  {startMonth && endMonth ? (
                    <>
                      {new Date(startMonth + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      {' - '}
                      {new Date(endMonth + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </>
                  ) : (
                    'Year to Date'
                  )}
                </div>
              </div>

              {/* Individual Metrics */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Individual</h4>
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Production
                    </label>
                    <p className="text-2xl font-bold text-green-500">
                      ${(agent.individual_production || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">{agent.individual_production_count || 0} deals</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Debt
                    </label>
                    <p className="text-2xl font-bold text-red-500">
                      ${(agent.individual_debt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">{agent.individual_debt_count || 0} deals</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Debt Ratio
                    </label>
                    <p className="text-2xl font-bold text-foreground">
                      {agent.individual_production > 0
                        ? ((agent.individual_debt / agent.individual_production) * 100).toFixed(1) + '%'
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Team Metrics (Downlines Only) */}
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Team (Downlines)</h4>
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Production
                    </label>
                    <p className="text-2xl font-bold text-green-500">
                      ${(agent.hierarchy_production || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">{agent.hierarchy_production_count || 0} deals</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Debt
                    </label>
                    <p className="text-2xl font-bold text-red-500">
                      ${(agent.hierarchy_debt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">{agent.hierarchy_debt_count || 0} deals</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Debt Ratio
                    </label>
                    <p className="text-2xl font-bold text-foreground">
                      {agent.debt_to_production_ratio != null
                        ? (agent.debt_to_production_ratio * 100).toFixed(1) + '%'
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Downlines List */}
          {agent.downlines > 0 && (
            <Card className="professional-card border-l-4 border-l-emerald-500">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Users className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-xl font-bold text-foreground">Direct Downlines</h3>
                </div>
                {loadingDownlines ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : downlines.length > 0 ? (
                  <div className="space-y-3">
                    {downlines.map((downline: any) => (
                      <div
                        key={downline.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 hover:border-primary/50 transition-all cursor-pointer"
                        onClick={() => {
                          // Replace current modal with downline's modal
                          onOpenChange(false);
                          // Wait for modal to close, then open the new one
                          setTimeout(() => {
                            // Trigger modal open with the downline's ID
                            const event = new CustomEvent('openAgentModal', { detail: { agentId: downline.id } });
                            window.dispatchEvent(event);
                          }, 100);
                        }}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`w-10 h-10 rounded-full ${badgeColors[downline.badge] || 'bg-muted text-muted-foreground'} flex items-center justify-center text-sm font-bold border`}>
                            {downline.name?.split(' ').map((n: string) => n.charAt(0)).slice(0, 2).join('') || 'A'}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-foreground">{downline.name}</p>
                              <Badge
                                className={`${statusColors[downline.status?.toLowerCase()] || 'bg-muted text-muted-foreground border-border'} border text-xs`}
                                variant="outline"
                              >
                                {downline.status ? downline.status.charAt(0).toUpperCase() + downline.status.slice(1).replace('-', ' ') : 'Active'}
                              </Badge>
                            </div>
                            {downline.position ? (
                              <Badge
                                className={`${getPositionColorByLevel(downline.position_level, positionColorMap)} border text-xs font-semibold`}
                                variant="outline"
                              >
                                {downline.position}
                              </Badge>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No Position</p>
                            )}
                          </div>
                          <div className="flex gap-6 text-sm">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground mb-1">Production</p>
                              <p className="font-semibold text-green-500">
                                ${(downline.individual_production || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground mb-1">Debt</p>
                              <p className="font-semibold text-red-500">
                                ${(downline.individual_debt || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground mb-1">Ratio</p>
                              <p className="font-semibold text-foreground">
                                {downline.individual_production > 0
                                  ? ((downline.individual_debt / downline.individual_production) * 100).toFixed(1) + '%'
                                  : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No downlines found</p>
                )}
              </CardContent>
            </Card>
          )}
          </div>
      </DialogContent>
    </Dialog>
  )
}

