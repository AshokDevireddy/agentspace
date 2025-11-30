"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, VisuallyHidden } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, User, Calendar, DollarSign, Users, Building2, Mail, Phone, CheckCircle2, UserCog, TrendingUp, Circle, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AgentDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  onUpdate?: () => void
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

export function AgentDetailsModal({ open, onOpenChange, agentId, onUpdate }: AgentDetailsModalProps) {
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [downlines, setDownlines] = useState<any[]>([])
  const [loadingDownlines, setLoadingDownlines] = useState(false)

  useEffect(() => {
    if (open && agentId) {
      fetchAgentDetails()
      fetchDownlines()
    }
  }, [open, agentId])

  const fetchAgentDetails = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch agent details')
      }

      const data = await response.json()
      // Convert name format from "Last, First" to "First Last" if needed
      // Also normalize status to lowercase for consistency
      const agentData = {
        ...data,
        name: data.name?.includes(',') 
          ? data.name.split(',').reverse().map((s: string) => s.trim()).join(' ')
          : data.name,
        status: data.status?.toLowerCase() || 'active'
      }
      setAgent(agentData)
    } catch (err) {
      console.error('Error fetching agent:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDownlines = async () => {
    setLoadingDownlines(true)
    try {
      const response = await fetch(`/api/agents/downlines?agentId=${agentId}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setDownlines(data.downlines || [])
      }
    } catch (err) {
      console.error('Error fetching downlines:', err)
    } finally {
      setLoadingDownlines(false)
    }
  }

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

  if (!agent && loading) {
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
                <Badge 
                  className={`${badgeColors[agent.badge] || 'bg-muted text-muted-foreground border-border'} border text-sm px-3 py-1`} 
                  variant="outline"
                >
                  <UserCog className="h-3 w-3 mr-1" />
                  {agent.badge || agent.position || 'Agent'}
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
                  <p className="text-lg font-semibold text-foreground">{agent.email || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Phone Number
                  </label>
                  <p className="text-lg font-semibold text-foreground">{agent.phone_number || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</label>
                  <p className="text-lg font-semibold text-foreground">{agent.role ? agent.role.charAt(0).toUpperCase() + agent.role.slice(1) : 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Position</label>
                  <p className="text-lg font-semibold text-foreground">{agent.position || 'Not Set'}</p>
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
                  <p className="text-lg font-semibold text-foreground">{agent.upline || 'None'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Downlines Count
                  </label>
                  <p className="text-lg font-semibold text-foreground">{agent.downlines || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card className="professional-card border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <h3 className="text-xl font-bold text-foreground">Performance Metrics</h3>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Earnings
                  </label>
                  <p className="text-2xl font-bold text-primary">{agent.earnings || '$0.00 / $0.00'}</p>
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
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${badgeColors[downline.badge] || 'bg-muted text-muted-foreground'} flex items-center justify-center text-xs font-bold border`}>
                            {downline.badge?.charAt(0) || downline.name?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{downline.name}</p>
                            <p className="text-xs text-muted-foreground">{downline.position || 'Agent'}</p>
                          </div>
                        </div>
                        <Badge
                          className={`${statusColors[downline.status?.toLowerCase()] || 'bg-muted text-muted-foreground border-border'} border`}
                          variant="outline"
                        >
                          {downline.status ? downline.status.charAt(0).toUpperCase() + downline.status.slice(1).replace('-', ' ') : 'Active'}
                        </Badge>
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

