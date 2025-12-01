"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from '@/lib/supabase/client'

interface AddUserModalProps {
  trigger: React.ReactNode
  upline?: string
}

// Interface for agent search results
interface AgentSearchResult {
  id: string
  first_name: string
  last_name: string
  email: string
  status?: string
}

// Interface for searchable select options
interface SearchOption {
  value: string
  label: string
  status?: string
  level?: number
}

// Permission levels - will be filtered based on current user's role
const allPermissionLevels = [
  { value: "agent", label: "Agent" },
  { value: "admin", label: "Admin" }
]

// Custom hook for debounced agent search
function useAgentSearch(pauseSearch = false) {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<SearchOption[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Debounce search functionality
  useEffect(() => {
    if (pauseSearch) {
      setIsSearching(false)
      return
    }

    // Don't search if term is too short
    if (searchTerm.length < 2) {
      setSearchResults([])
      return
    }

    // Debounce timer
    const debounceTimer = setTimeout(async () => {
      try {
        setIsSearching(true)
        setSearchError(null)

        // API ROUTE CALL - This calls the secure endpoint for upline search (current user + downline)
        const response = await fetch(`/api/search-agents?q=${encodeURIComponent(searchTerm)}&limit=10&type=downline`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include' // Include authentication cookies
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage = errorData?.error || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(`Failed to search agents: ${errorMessage}`)
        }

        const agents: AgentSearchResult[] = await response.json()

        // Handle empty results gracefully
        if (!Array.isArray(agents)) {
          console.warn('Search API returned non-array result:', agents);
          setSearchResults([]);
          return;
        }

        // Transform search results into select options
        const options: SearchOption[] = agents.map(agent => ({
          value: agent.id,
          label: `${agent.first_name} ${agent.last_name}${agent.email ? ' - ' + agent.email : ''}${agent.status === 'pre-invite' ? ' (Pre-invite)' : ''}`,
          status: agent.status
        }))

        setSearchResults(options)
      } catch (error) {
        console.error('Agent search error:', error)
        // Only show error to user if it's not related to auto-population
        if (searchTerm.length > 0) {
          setSearchError('Failed to search agents. Please try again.')
        }
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400) // 400ms debounce delay

    // Cleanup timer on searchTerm change
    return () => clearTimeout(debounceTimer)
  }, [searchTerm, pauseSearch])

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
    searchError
  }
}

export default function AddUserModal({ trigger, upline }: AddUserModalProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    permissionLevel: "",
    uplineAgentId: "",
    positionId: ""
  })
  const [isOpen, setIsOpen] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [errorFields, setErrorFields] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedPreInviteUserId, setSelectedPreInviteUserId] = useState<string | null>(null)
  const [nameSearchTerm, setNameSearchTerm] = useState("")
  const [nameSearchResults, setNameSearchResults] = useState<SearchOption[]>([])
  const [isNameSearching, setIsNameSearching] = useState(false)
  const [positions, setPositions] = useState<SearchOption[]>([])
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [currentUserPositionLevel, setCurrentUserPositionLevel] = useState<number | null>(null)
  const [selectedUplineLabel, setSelectedUplineLabel] = useState<string>("")
  const [hasSetDefaultUpline, setHasSetDefaultUpline] = useState(false)
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState<boolean>(false)
  const [pauseNameSearch, setPauseNameSearch] = useState(false)
  const [pauseUplineSearch, setPauseUplineSearch] = useState(false)
  const [uplineInputValue, setUplineInputValue] = useState("")

  // Use the custom agent search hook for upline selection
  const {
    searchTerm: uplineSearchTerm,
    setSearchTerm: setUplineSearchTerm,
    searchResults: uplineSearchResults,
    isSearching: isUplineSearching,
    searchError: uplineSearchError
  } = useAgentSearch(pauseUplineSearch)

  // Filter permission levels based on current user's admin status
  // Admins can add both agents and admins, but agents can only add agents
  const permissionLevels = isCurrentUserAdmin
    ? allPermissionLevels
    : allPermissionLevels.filter(level => level.value === 'agent')

  // Name search for pre-invite users
  useEffect(() => {
    if (pauseNameSearch) {
      return
    }

    if (nameSearchTerm.length < 2) {
      setNameSearchResults([])
      return
    }

    const debounceTimer = setTimeout(async () => {
      try {
        setIsNameSearching(true)
        console.log('[ADD-USER-MODAL] Starting name search for:', nameSearchTerm)

        const response = await fetch(`/api/search-agents?q=${encodeURIComponent(nameSearchTerm)}&limit=10&type=pre-invite`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        })

        console.log('[ADD-USER-MODAL] Response status:', response.status, response.statusText)

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage = errorData?.error || `Search failed`;
          console.error('[ADD-USER-MODAL] Name search error:', errorMessage, errorData?.detail)
          console.error('[ADD-USER-MODAL] Full error data:', errorData)
          // Don't throw error, just set empty results
          setNameSearchResults([])
          return
        }

        const agents: AgentSearchResult[] = await response.json()
        console.log('[ADD-USER-MODAL] Received', agents?.length || 0, 'agents')

        // Handle empty results gracefully
        if (!Array.isArray(agents)) {
          console.warn('[ADD-USER-MODAL] Search API returned non-array result:', agents);
          setNameSearchResults([]);
          return;
        }

        const options: SearchOption[] = agents.map(agent => ({
          value: agent.id,
          label: `${agent.first_name} ${agent.last_name}${agent.email ? ' - ' + agent.email : ''}${agent.status === 'pre-invite' ? ' (Pre-invite)' : ''}`,
          status: agent.status
        }))

        console.log('[ADD-USER-MODAL] Mapped to', options.length, 'options')
        setNameSearchResults(options)
      } catch (error) {
        console.error('[ADD-USER-MODAL] Name search exception:', error)
        setNameSearchResults([])
      } finally {
        setIsNameSearching(false)
      }
    }, 400)

    return () => clearTimeout(debounceTimer)
  }, [nameSearchTerm, pauseNameSearch])

  // Fetch positions when modal opens
  useEffect(() => {
    if (isOpen && !positionsLoading && positions.length === 0) {
      fetchPositions()
    }
  }, [isOpen])

  const fetchPositions = async () => {
    try {
      setPositionsLoading(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) return

      // Fetch current user's position level
      let userPositionLevel: number | null = null
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const profileResponse = await fetch(`/api/user/profile?user_id=${user.id}`)
        if (profileResponse.ok) {
          const profileData = await profileResponse.json()
          if (profileData.success && profileData.data.position) {
            userPositionLevel = profileData.data.position.level
            setCurrentUserPositionLevel(userPositionLevel)
          }
        }
      }

      const response = await fetch('/api/positions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        // Filter positions: only show positions BELOW current user's level (not including their level)
        const filteredData = userPositionLevel !== null
          ? data.filter((pos: any) => pos.level < userPositionLevel)
          : data

        const positionOptions: SearchOption[] = filteredData.map((pos: any) => ({
          value: pos.position_id,
          label: `${pos.name} (Level ${pos.level})`,
          level: pos.level
        }))
        setPositions(positionOptions)
      }
    } catch (error) {
      console.error('Error fetching positions:', error)
    } finally {
      setPositionsLoading(false)
    }
  }

  // Reset default upline flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasSetDefaultUpline(false)
    }
  }, [isOpen])

  // Fetch current user's admin status when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchCurrentUserAdminStatus = async () => {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()

          if (user) {
            const { data: userData } = await supabase
              .from('users')
              .select('is_admin, perm_level')
              .eq('auth_user_id', user.id)
              .single()

            if (userData) {
              const isAdmin = userData.is_admin || userData.perm_level === 'admin'
              setIsCurrentUserAdmin(isAdmin)

              // If not an admin, automatically set permission level to 'agent' (the only option)
              if (!isAdmin && !formData.permissionLevel) {
                setFormData(prev => ({ ...prev, permissionLevel: 'agent' }))
              }
            }
          }
        } catch (error) {
          console.error('Error fetching current user admin status:', error)
        }
      }

      fetchCurrentUserAdminStatus()
    }
  }, [isOpen])

  // Fetch current user as default upline when no upline is provided (only once per modal open)
  useEffect(() => {
    if (!upline && isOpen && !hasSetDefaultUpline) {
      const fetchCurrentUser = async () => {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()

          if (user) {
            const { data: userData } = await supabase
              .from('users')
              .select('id, first_name, last_name, email, is_admin, perm_level')
              .eq('auth_user_id', user.id)
              .single()

            if (userData) {
              // Set current user as default upline
              const userLabel = `${userData.first_name} ${userData.last_name} - ${userData.email}`
              applyUplineSelection({ value: userData.id, label: userLabel })
              setHasSetDefaultUpline(true)

              // Check if current user is admin
              setIsCurrentUserAdmin(userData.is_admin || userData.perm_level === 'admin')
            }
          }
        } catch (error) {
          console.error('Error fetching current user for default upline:', error)
        }
      }

      fetchCurrentUser()
    }
  }, [upline, isOpen, hasSetDefaultUpline])

  // When upline is provided from graph view, trigger search to find the user
  useEffect(() => {
    if (upline && isOpen) {
      // Small delay to ensure modal is fully loaded before triggering search
      const timer = setTimeout(() => {
        // Convert "Last, First" format to "First Last" format for better search matching
        let searchQuery = upline;
        if (upline.includes(',')) {
          const parts = upline.split(',').map(part => part.trim());
          if (parts.length === 2) {
            searchQuery = `${parts[1]} ${parts[0]}`; // "Devireddy, Ashok" -> "Ashok Devireddy"
          }
        }

        // Auto-populate search term with converted name to trigger search
        setPauseUplineSearch(false)
        setUplineInputValue(searchQuery);
        setUplineSearchTerm(searchQuery);
      }, 100); // Small delay to prevent race conditions

      return () => clearTimeout(timer);
    }
  }, [upline, isOpen]);

  // Auto-select upline agent when search results include the upline
  useEffect(() => {
    if (upline && uplineSearchResults.length > 0) {
      // Try to find the upline user using multiple matching strategies
      let uplineUser = null;

      // Strategy 1: Direct match with original format (case insensitive)
      uplineUser = uplineSearchResults.find(agent =>
        agent.label.toLowerCase().includes(upline.toLowerCase())
      );

      // Strategy 2: Convert and match "Last, First" -> "First Last"
      if (!uplineUser && upline.includes(',')) {
        const parts = upline.split(',').map(part => part.trim());
        if (parts.length === 2) {
          const convertedName = `${parts[1]} ${parts[0]}`;
          uplineUser = uplineSearchResults.find(agent =>
            agent.label.toLowerCase().includes(convertedName.toLowerCase())
          );
        }
      }

      // Strategy 3: Match individual name parts
      if (!uplineUser) {
        const nameParts = upline.includes(',')
          ? upline.split(',').map(part => part.trim())
          : upline.split(' ').map(part => part.trim());

        uplineUser = uplineSearchResults.find(agent => {
          const agentLabel = agent.label.toLowerCase();
          return nameParts.every(part =>
            part.length > 1 && agentLabel.includes(part.toLowerCase())
          );
        });
      }

      if (uplineUser && !formData.uplineAgentId) {
        applyUplineSelection(uplineUser)
      }
    }
  }, [upline, uplineSearchResults, formData.uplineAgentId]);


  const validateForm = () => {
    const newErrors: string[] = []
    const newErrorFields: Record<string, string> = {}

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      newErrors.push("Invalid email format")
      newErrorFields.email = "Invalid email format"
    }

    // Phone validation (10 digits)
    if (formData.phoneNumber.length != 10) {
      newErrors.push("Phone number must be 10 digits")
      newErrorFields.phoneNumber = "Invalid phone format"
    }

    // Permission level validation
    if (!formData.permissionLevel) {
      newErrors.push("Permission level is required")
      newErrorFields.permissionLevel = "Required"
    }

    // Position validation
    if (!formData.positionId) {
      newErrors.push("Position is required")
      newErrorFields.positionId = "Required"
    }

    // Upline validation - ensure user selects from dropdown if they typed a value
    if (uplineInputValue.trim().length > 0 && !formData.uplineAgentId) {
      const message = "Please select a valid upline from the dropdown"
      newErrors.push(message)
      newErrorFields.uplineAgentId = message
    }

    setErrors(newErrors)
    setErrorFields(newErrorFields)
    return newErrors.length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    try {
      setSubmitting(true)

      // Call the API to invite the agent (will update pre-invite if selectedPreInviteUserId is set)
      const response = await fetch('/api/agents/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phoneNumber: formData.phoneNumber,
          permissionLevel: formData.permissionLevel,
          uplineAgentId: formData.uplineAgentId || null,
          positionId: formData.positionId || null,
          preInviteUserId: selectedPreInviteUserId // Include pre-invite user ID if updating
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite agent')
      }

      // Show success message
      const message = selectedPreInviteUserId
        ? `User ${formData.firstName} ${formData.lastName} updated and invitation sent to ${formData.email}!`
        : `Invitation sent successfully to ${formData.email}!`
      alert(message)

      setIsOpen(false)
      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        permissionLevel: "",
        uplineAgentId: "",
        positionId: ""
      })
      setErrors([])
      setErrorFields({})
      setPauseNameSearch(false)
      setPauseUplineSearch(false)
      setUplineSearchTerm("") // Reset upline search term
      setUplineInputValue("")
      setSelectedUplineLabel("") // Reset selected upline label
      setSelectedPreInviteUserId(null)
      setHasSetDefaultUpline(false) // Reset default upline flag

      // Optionally refresh the page to show new agent
      window.location.reload()
    } catch (error) {
      console.error('Error inviting agent:', error)
      setErrors([error instanceof Error ? error.message : 'Failed to invite agent. Please try again.'])
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  // Handle upline agent selection
  const handleUplineAgentChange = (agentId: string) => {
    setFormData({ ...formData, uplineAgentId: agentId })
  }

  const applyUplineSelection = (option: SearchOption) => {
    handleUplineAgentChange(option.value)
    setSelectedUplineLabel(option.label)
    setUplineInputValue(option.label)
    setUplineSearchTerm(option.label)
    setPauseUplineSearch(true)
    setErrorFields(prev => {
      const { uplineAgentId, ...rest } = prev
      return rest
    })
  }

  const clearUplineSelection = () => {
    handleUplineAgentChange("")
    setSelectedUplineLabel("")
    setUplineInputValue("")
    setPauseUplineSearch(false)
    setUplineSearchTerm("")
    setErrorFields(prev => {
      const { uplineAgentId, ...rest } = prev
      return rest
    })
  }

  // Handle pre-invite user selection
  const handlePreInviteUserSelect = async (userId: string, selectedOption: SearchOption) => {
    try {
      setLoading(true)
      setPauseNameSearch(true)

      // Fetch full user details
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !user) {
        console.error('Error fetching user:', error)
        setErrors(['Failed to load user data'])
        return
      }

      // Pre-fill the form with user data
      setFormData({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        email: user.email || "",
        phoneNumber: user.phone_number || "",
        permissionLevel: user.perm_level || "",
        uplineAgentId: user.upline_id || "",
        positionId: user.position_id || ""
      })

      setSelectedPreInviteUserId(userId)
      setNameSearchTerm(selectedOption.label)
      setNameSearchResults([])

      // If there's an upline, set the search term for upline field
      if (user.upline_id) {
        const uplineOption = uplineSearchResults.find(r => r.value === user.upline_id)
        if (uplineOption) {
          applyUplineSelection(uplineOption)
        }
      }
    } catch (error) {
      console.error('Error selecting pre-invite user:', error)
      setErrors(['Failed to load user data'])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto add-user-modal">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground mb-6">Add a User</DialogTitle>
          <DialogDescription>Create a new user account in your agency</DialogDescription>
        </DialogHeader>

        {errors.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {errors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Show search error if any */}
        {uplineSearchError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{uplineSearchError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Search for Pre-invite Users */}
          <div className="space-y-2 p-4 bg-accent/30 rounded-lg border border-border">
            <label className="block text-sm font-medium text-foreground">
              Search by Name (Optional)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Search for an existing pre-invite user to update their information, or leave blank to create a new user.
            </p>
            <div className="relative">
              <Input
                type="text"
                value={nameSearchTerm}
                onChange={(e) => {
                  setPauseNameSearch(false)
                  setNameSearchTerm(e.target.value)
                  // Clear selection if user changes search
                  if (selectedPreInviteUserId) {
                    setSelectedPreInviteUserId(null)
                    setFormData({
                      firstName: "",
                      lastName: "",
                      email: "",
                      phoneNumber: "",
                      permissionLevel: "",
                      uplineAgentId: "",
                      positionId: ""
                    })
                  }
                }}
                className="h-12"
                placeholder="Type name to search..."
              />
              {isNameSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                </div>
              )}
            </div>

            {/* Name search results dropdown */}
            {nameSearchTerm.length >= 2 && !isNameSearching && nameSearchResults.length > 0 && (
              <div className="border border-border rounded-lg bg-card shadow-lg max-h-60 overflow-y-auto z-10">
                {nameSearchResults.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-accent/50 border-b border-border last:border-b-0 transition-colors"
                    onClick={() => handlePreInviteUserSelect(option.value, option)}
                  >
                    <div className="text-sm font-medium text-foreground">
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No results or success message */}
            {nameSearchTerm.length >= 2 && !isNameSearching && nameSearchResults.length === 0 && (
              <div
                className={`border rounded-lg shadow-lg p-4 z-10 text-center ${
                  selectedPreInviteUserId ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-card"
                }`}
              >
                {selectedPreInviteUserId ? (
                  <p className="text-sm text-emerald-400">
                    Found existing agent: {formData.firstName} {formData.lastName}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No agents found matching "{nameSearchTerm}"
                  </p>
                )}
              </div>
            )}

            {/* Selected pre-invite user indicator */}
            {selectedPreInviteUserId && (
              <div className="mt-2 p-2 bg-blue-500/20 rounded border border-blue-500/30">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-400">
                    Updating existing user: {formData.firstName} {formData.lastName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPreInviteUserId(null)
                      setNameSearchTerm("")
                      setPauseNameSearch(false)
                      setFormData({
                        firstName: "",
                        lastName: "",
                        email: "",
                        phoneNumber: "",
                        permissionLevel: "",
                        uplineAgentId: "",
                        positionId: ""
                      })
                      clearUplineSelection()
                    }}
                    className="text-destructive hover:text-destructive/80 text-sm transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* First name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              First name
            </label>
            <Input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              className={`h-12 ${errorFields.firstName ? 'border-red-500' : ''} ${selectedPreInviteUserId ? 'bg-muted text-foreground/80 cursor-not-allowed' : ''}`}
              required
              readOnly={!!selectedPreInviteUserId}
              aria-readonly={selectedPreInviteUserId ? true : undefined}
            />
            {errorFields.firstName && (
              <p className="text-red-500 text-sm">{errorFields.firstName}</p>
            )}
            {selectedPreInviteUserId && (
              <p className="text-xs text-muted-foreground">Name cannot be changed for existing users</p>
            )}
          </div>

          {/* Last name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Last name
            </label>
            <Input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              className={`h-12 ${selectedPreInviteUserId ? 'bg-muted text-foreground/80 cursor-not-allowed' : ''}`}
              required
              readOnly={!!selectedPreInviteUserId}
              aria-readonly={selectedPreInviteUserId ? true : undefined}
            />
            {selectedPreInviteUserId && (
              <p className="text-xs text-muted-foreground">Name cannot be changed for existing users</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className="h-12"
              required
            />
          </div>

          {/* Phone number */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Phone number
            </label>
            <Input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
              className={`h-12 ${errorFields.phoneNumber ? 'border-red-500' : ''}`}
              placeholder="xxx-xxx-xxxx"
              required
            />
            {errorFields.phoneNumber && (
              <p className="text-red-500 text-sm">{errorFields.phoneNumber}</p>
            )}
          </div>

          {/* Permission Level */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Permission Level
            </label>
            <SimpleSearchableSelect
              options={permissionLevels}
              value={formData.permissionLevel}
              onValueChange={(value) => handleInputChange("permissionLevel", value)}
              placeholder="Select permission level"
              searchPlaceholder="Search permission levels..."
            />
            {errorFields.permissionLevel && (
              <p className="text-red-500 text-sm">{errorFields.permissionLevel}</p>
            )}
          </div>

          {/* Position Selection (Optional) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Position <span className="text-red-500">*</span>
            </label>
            <SimpleSearchableSelect
              options={positions}
              value={formData.positionId}
              onValueChange={(value) => handleInputChange("positionId", value)}
              placeholder="Select position..."
              searchPlaceholder="Search positions..."
            />
            <p className="text-sm text-muted-foreground">
              Select a position for this agent. Only positions below your level are shown.
            </p>
          </div>

          {/* Upline Agent Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Upline Agent (Optional)
            </label>
            <div className="relative">
              <Input
                type="text"
                value={uplineInputValue}
                onChange={(e) => {
                  const value = e.target.value
                  setUplineInputValue(value)
                  setUplineSearchTerm(value)
                  setPauseUplineSearch(false)
                  if (formData.uplineAgentId) {
                    handleUplineAgentChange("")
                    setSelectedUplineLabel("")
                  }
                }}
                className={`h-12 ${errorFields.uplineAgentId ? 'border-red-500' : ''}`}
                placeholder="Type to search for upline agent..."
              />
              {/* Loading indicator */}
              {isUplineSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                </div>
              )}
            </div>

            {/* Search results dropdown */}
            {uplineSearchResults.length > 0 && !pauseUplineSearch && (
              <div className="border border-border rounded-lg bg-card shadow-lg max-h-60 overflow-y-auto z-10">
                {uplineSearchResults.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-accent/50 border-b border-border last:border-b-0 transition-colors"
                    onClick={() => applyUplineSelection(option)}
                  >
                    <div className="text-sm font-medium text-foreground">
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected agent display */}
            {formData.uplineAgentId && (
              <div className="mt-2 p-2 bg-accent/30 rounded border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">
                    Selected: {selectedUplineLabel || 'Agent selected'}
                  </span>
                  <button
                    type="button"
                    onClick={clearUplineSelection}
                    className="text-destructive hover:text-destructive/80 text-sm transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Start typing to search by name or email. Minimum 2 characters required.
            </p>
            {errorFields.uplineAgentId && (
              <p className="text-sm text-red-500">{errorFields.uplineAgentId}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <Button
              type="submit"
              className="w-full py-2 btn-gradient font-semibold text-lg disabled:opacity-60"
              disabled={submitting || loading}
            >
              {submitting ? 'Creating User...' : 'Submit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
