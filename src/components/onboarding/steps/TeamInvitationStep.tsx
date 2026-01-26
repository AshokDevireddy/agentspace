'use client'

/**
 * Team Invitation Step
 *
 * Allows users to invite team members during onboarding.
 * Supports both new invitations and linking to pre-invite users.
 */
import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SimpleSearchableSelect } from '@/components/ui/simple-searchable-select'
import { createClient } from '@/lib/supabase/client'
import { useInviteAgent } from '@/hooks/mutations'
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress'
import type { UserData, InvitedAgent, SearchOption } from '../types'

interface TeamInvitationStepProps {
  userData: UserData
  onComplete: () => void
  onBack: () => void
}

const PERMISSION_LEVELS = [
  { value: 'agent', label: 'Agent' },
  { value: 'admin', label: 'Admin' },
]

export function TeamInvitationStep({ userData, onComplete, onBack }: TeamInvitationStepProps) {
  const supabase = createClient()
  const onboardingProgress = useOnboardingProgress(userData.id)

  // Local invitation state
  const [invitedAgents, setInvitedAgents] = useState<InvitedAgent[]>([])
  const [showAgentForm, setShowAgentForm] = useState(false)
  const [currentAgentForm, setCurrentAgentForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    permissionLevel: '',
    uplineAgentId: '',
  })
  const [selectedPreInviteUserId, setSelectedPreInviteUserId] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Search state
  const [agentSearchTerm, setAgentSearchTerm] = useState('')
  const [agentSearchResults, setAgentSearchResults] = useState<SearchOption[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [nameSearchTerm, setNameSearchTerm] = useState('')
  const [nameSearchResults, setNameSearchResults] = useState<SearchOption[]>([])
  const [isNameSearching, setIsNameSearching] = useState(false)

  // Mutations
  const inviteAgentMutation = useInviteAgent()

  // Sync with server state
  useEffect(() => {
    if (onboardingProgress?.progress?.pending_invitations) {
      setInvitedAgents(onboardingProgress.progress.pending_invitations)
    }
  }, [onboardingProgress?.progress?.pending_invitations])

  // Agent search for upline selection
  useEffect(() => {
    if (agentSearchTerm.length < 2) {
      setAgentSearchResults([])
      return
    }

    const debounceTimer = setTimeout(async () => {
      try {
        setIsSearching(true)
        const response = await fetch(
          `/api/search-agents?q=${encodeURIComponent(agentSearchTerm)}&limit=10&type=downline`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          }
        )

        if (response.ok) {
          const agents = await response.json()
          if (Array.isArray(agents)) {
            setAgentSearchResults(
              agents.map((agent) => ({
                value: agent.id,
                label: `${agent.first_name} ${agent.last_name} - ${agent.email}`,
              }))
            )
          }
        }
      } catch (error) {
        console.error('Agent search error:', error)
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => clearTimeout(debounceTimer)
  }, [agentSearchTerm])

  // Pre-invite user search
  useEffect(() => {
    if (nameSearchTerm.length < 2) {
      setNameSearchResults([])
      return
    }

    const debounceTimer = setTimeout(async () => {
      try {
        setIsNameSearching(true)
        const response = await fetch(
          `/api/search-agents?q=${encodeURIComponent(nameSearchTerm)}&limit=10&type=pre-invite`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          }
        )

        if (response.ok) {
          const agents = await response.json()
          if (Array.isArray(agents)) {
            setNameSearchResults(
              agents.map((agent) => ({
                value: agent.id,
                label: `${agent.first_name} ${agent.last_name}${
                  agent.email ? ' - ' + agent.email : ''
                }${agent.status === 'pre-invite' ? ' (Pre-invite)' : ''}`,
                status: agent.status,
              }))
            )
          }
        }
      } catch (error) {
        console.error('Name search error:', error)
      } finally {
        setIsNameSearching(false)
      }
    }, 400)

    return () => clearTimeout(debounceTimer)
  }, [nameSearchTerm])

  // Validate agent form
  const validateAgentForm = useCallback((): boolean => {
    const newErrors: string[] = []

    if (!currentAgentForm.firstName.trim()) {
      newErrors.push('First name is required')
    }
    if (!currentAgentForm.lastName.trim()) {
      newErrors.push('Last name is required')
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(currentAgentForm.email)) {
      newErrors.push('Invalid email format')
    }
    if (currentAgentForm.phoneNumber.length !== 10) {
      newErrors.push('Phone number must be 10 digits')
    }
    if (!currentAgentForm.permissionLevel) {
      newErrors.push('Permission level is required')
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }, [currentAgentForm])

  // Add agent to pending list
  const handleAddAgent = async () => {
    if (!validateAgentForm()) return

    const newAgent: InvitedAgent = {
      firstName: currentAgentForm.firstName,
      lastName: currentAgentForm.lastName,
      email: currentAgentForm.email,
      phoneNumber: currentAgentForm.phoneNumber,
      permissionLevel: currentAgentForm.permissionLevel,
      uplineAgentId: currentAgentForm.uplineAgentId || null,
      preInviteUserId: selectedPreInviteUserId,
    }

    // Save to server
    if (onboardingProgress) {
      try {
        await onboardingProgress.addInvitation(newAgent)
      } catch (error) {
        console.error('Failed to add invitation:', error)
        setErrors(['Failed to save invitation. Please try again.'])
        return
      }
    } else {
      // Fallback to local state if onboarding progress not available
      setInvitedAgents([...invitedAgents, newAgent])
    }

    // Reset form
    setCurrentAgentForm({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      permissionLevel: '',
      uplineAgentId: '',
    })
    setAgentSearchTerm('')
    setNameSearchTerm('')
    setSelectedPreInviteUserId(null)
    setShowAgentForm(false)
    setErrors([])
  }

  // Remove agent from pending list
  const handleRemoveAgent = async (index: number) => {
    if (onboardingProgress) {
      try {
        await onboardingProgress.removeInvitation(index)
      } catch (error) {
        console.error('Failed to remove invitation:', error)
      }
    } else {
      setInvitedAgents(invitedAgents.filter((_, i) => i !== index))
    }
  }

  // Handle pre-invite user selection
  const handlePreInviteUserSelect = async (userId: string, option: SearchOption) => {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !user) {
        setErrors(['Failed to load user data'])
        return
      }

      // Type assertion for user data from Supabase
      const userData = user as {
        first_name?: string
        last_name?: string
        email?: string
        phone_number?: string
        perm_level?: string
        upline_id?: string
      }

      setCurrentAgentForm({
        firstName: userData.first_name || '',
        lastName: userData.last_name || '',
        email: userData.email || '',
        phoneNumber: userData.phone_number || '',
        permissionLevel: userData.perm_level || '',
        uplineAgentId: userData.upline_id || '',
      })

      setSelectedPreInviteUserId(userId)
      setNameSearchTerm(option.label)
      setNameSearchResults([])
    } catch (error) {
      console.error('Error selecting pre-invite user:', error)
      setErrors(['Failed to load user data'])
    }
  }

  // Send all invitations and complete
  const handleComplete = async () => {
    setIsSubmitting(true)
    setErrors([])

    const agentsToInvite = onboardingProgress?.progress?.pending_invitations || invitedAgents

    if (agentsToInvite.length === 0) {
      onComplete()
      return
    }

    const inviteErrors: string[] = []

    for (const agent of agentsToInvite) {
      try {
        await inviteAgentMutation.mutateAsync({
          email: agent.email,
          firstName: agent.firstName,
          lastName: agent.lastName,
          phoneNumber: agent.phoneNumber,
          permissionLevel: agent.permissionLevel,
          uplineAgentId: agent.uplineAgentId || userData.id,
          preInviteUserId: agent.preInviteUserId,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Network error'
        inviteErrors.push(`${agent.firstName} ${agent.lastName}: ${errorMessage}`)
      }
    }

    if (inviteErrors.length > 0) {
      setErrors(inviteErrors)
    }

    setIsSubmitting(false)
    onComplete()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold text-foreground">Invite Your Team</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add agents to your team and configure their permissions
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/30">
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}

      {/* Invited Agents List */}
      {invitedAgents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Pending Invitations</h3>
          {invitedAgents.map((agent, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border"
            >
              <div>
                <p className="font-medium text-foreground">
                  {agent.firstName} {agent.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {agent.email} - {agent.permissionLevel}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveAgent(index)}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Agent Form */}
      {showAgentForm ? (
        <div className="space-y-4 p-4 border border-border rounded-lg">
          <h3 className="text-sm font-semibold text-foreground">Add Team Member</h3>

          {/* Pre-invite search */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Search Existing (Optional)
            </label>
            <Input
              value={nameSearchTerm}
              onChange={(e) => setNameSearchTerm(e.target.value)}
              placeholder="Search by name..."
            />
            {isNameSearching && (
              <p className="text-xs text-muted-foreground">Searching...</p>
            )}
            {nameSearchResults.length > 0 && (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {nameSearchResults.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                    onClick={() => handlePreInviteUserSelect(option.value, option)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                First Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={currentAgentForm.firstName}
                onChange={(e) =>
                  setCurrentAgentForm({ ...currentAgentForm, firstName: e.target.value })
                }
                placeholder="First name"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Last Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={currentAgentForm.lastName}
                onChange={(e) =>
                  setCurrentAgentForm({ ...currentAgentForm, lastName: e.target.value })
                }
                placeholder="Last name"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Email <span className="text-destructive">*</span>
              </label>
              <Input
                type="email"
                value={currentAgentForm.email}
                onChange={(e) =>
                  setCurrentAgentForm({ ...currentAgentForm, email: e.target.value })
                }
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Phone <span className="text-destructive">*</span>
              </label>
              <Input
                value={currentAgentForm.phoneNumber}
                onChange={(e) =>
                  setCurrentAgentForm({
                    ...currentAgentForm,
                    phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10),
                  })
                }
                placeholder="10 digits"
                maxLength={10}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Permission Level <span className="text-destructive">*</span>
              </label>
              <SimpleSearchableSelect
                value={currentAgentForm.permissionLevel}
                onValueChange={(value) =>
                  setCurrentAgentForm({ ...currentAgentForm, permissionLevel: value })
                }
                options={PERMISSION_LEVELS}
                placeholder="Select permission level"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Upline (Optional)</label>
              <Input
                value={agentSearchTerm}
                onChange={(e) => setAgentSearchTerm(e.target.value)}
                placeholder="Search agents..."
              />
              {isSearching && (
                <p className="text-xs text-muted-foreground">Searching...</p>
              )}
              {agentSearchResults.length > 0 && (
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {agentSearchResults.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      onClick={() => {
                        setCurrentAgentForm({ ...currentAgentForm, uplineAgentId: option.value })
                        setAgentSearchTerm(option.label)
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowAgentForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAgent}>Add to List</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowAgentForm(true)} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Team Member
        </Button>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-border">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          {invitedAgents.length === 0 && (
            <Button variant="outline" onClick={onComplete}>
              Skip
            </Button>
          )}
          <Button onClick={handleComplete} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Invitations...
              </>
            ) : invitedAgents.length > 0 ? (
              `Complete & Send ${invitedAgents.length} Invitation${invitedAgents.length > 1 ? 's' : ''}`
            ) : (
              'Complete Setup'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
