"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/providers/AuthProvider"
import { getClientAccessToken } from "@/lib/auth/client"
import { useNotification } from "@/contexts/notification-context"
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queryKeys'
import { useSendInvite } from '@/hooks/mutations'

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

// Custom hook for debounced agent search using TanStack Query
// Uses proper abort signals to prevent race conditions from slow responses
function useAgentSearch(pauseSearch = false) {
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")

  // Debounce search term to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 400) // 400ms debounce delay
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Use TanStack Query with abort signal for proper request cancellation
  const { data: searchResults = [], isLoading: isSearching, error } = useQuery<SearchOption[]>({
    queryKey: queryKeys.searchAgents(debouncedSearchTerm),
    queryFn: async ({ signal }) => {
      // API ROUTE CALL - This calls the secure endpoint for upline search (current user + downline)
      const response = await fetch(
        `/api/search-agents?q=${encodeURIComponent(debouncedSearchTerm)}&limit=10&type=downline`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal, // Abort signal cancels in-flight requests when search term changes
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(`Failed to search agents: ${errorMessage}`)
      }

      const agents: AgentSearchResult[] = await response.json()

      // Handle empty results gracefully
      if (!Array.isArray(agents)) {
        console.warn('Search API returned non-array result:', agents)
        return []
      }

      // Transform search results into select options
      return agents.map(agent => ({
        value: agent.id,
        label: `${agent.first_name} ${agent.last_name}${agent.email ? ' - ' + agent.email : ''}${agent.status === 'pre-invite' ? ' (Pre-invite)' : ''}`,
        status: agent.status
      }))
    },
    // Only fetch when: not paused, and search term is at least 2 characters
    enabled: !pauseSearch && debouncedSearchTerm.length >= 2,
    staleTime: 30000, // Cache results for 30 seconds
    retry: false, // Don't retry failed searches
  })

  const searchError = error ? 'Failed to search agents. Please try again.' : null

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
    searchError
  }
}

export default function AddUserModal({ trigger, upline }: AddUserModalProps) {
  const { showSuccess } = useNotification()
  const queryClient = useQueryClient()
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
  const [loading, setLoading] = useState(false)
  const [selectedPreInviteUserId, setSelectedPreInviteUserId] = useState<string | null>(null)
  const [selectedPreInviteUserLabel, setSelectedPreInviteUserLabel] = useState<string>("")
  const [isLoadingPreInviteUser, setIsLoadingPreInviteUser] = useState(false)
  const [nameSearchTerm, setNameSearchTerm] = useState("")
  const [debouncedNameSearchTerm, setDebouncedNameSearchTerm] = useState("")
  const [showNameDropdown, setShowNameDropdown] = useState(false)
  const [selectedUplineLabel, setSelectedUplineLabel] = useState<string>("")
  const [hasSetDefaultUpline, setHasSetDefaultUpline] = useState(false)
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

  // Get user data from AuthProvider
  const { user: authUser } = useAuth()
  const isCurrentUserAdmin = authUser?.is_admin || false

  // Query: Fetch positions when modal opens
  const { data: positionsData, isLoading: positionsLoading } = useQuery({
    queryKey: queryKeys.positionsList(),
    queryFn: async () => {
      const accessToken = await getClientAccessToken()

      if (!accessToken) {
        throw new Error('No access token available')
      }

      const response = await fetch('/api/positions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch positions')
      }

      const data = await response.json()

      interface PositionData {
        position_id: string
        name: string
        level: number
      }

      // Note: Position-level filtering now handled by API based on user context
      return {
        positions: data.map((pos: PositionData) => ({
          value: pos.position_id,
          label: `${pos.name} (Level ${pos.level})`,
          level: pos.level
        })) as SearchOption[],
      }
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  })

  const positions = positionsData?.positions || []

  // Effect to auto-set permission level for non-admin users
  useEffect(() => {
    if (isOpen && !isCurrentUserAdmin && !formData.permissionLevel) {
      setFormData(prev => ({ ...prev, permissionLevel: 'agent' }))
    }
  }, [isOpen, isCurrentUserAdmin, formData.permissionLevel])

  // Effect to apply current user as default upline when no upline is provided
  useEffect(() => {
    if (authUser && !upline && isOpen && !hasSetDefaultUpline) {
      // Fetch user's full name via API to set as default upline
      const fetchUserDetails = async () => {
        try {
          const accessToken = await getClientAccessToken()
          if (!accessToken) return

          const response = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          })
          if (!response.ok) return

          const data = await response.json()
          const userData = data.data || data

          applyUplineSelection({
            value: authUser.id,
            label: `${userData.first_name || ''} ${userData.last_name || ''} - ${authUser.email}`
          })
          setHasSetDefaultUpline(true)
        } catch {
          // Ignore errors - just don't set default upline
        }
      }
      fetchUserDetails()
    }
  }, [authUser, upline, isOpen, hasSetDefaultUpline])

  // Mutation: Submit form to invite agent - using centralized hook
  const inviteAgentMutation = useSendInvite({
    invalidateClients: true, // Also invalidate clients and agentsPendingPositions
    onSuccess: (data, variables) => {
      const message = selectedPreInviteUserId
        ? `User ${variables.firstName} ${variables.lastName} updated and invitation sent to ${variables.email}!`
        : `Invitation sent successfully to ${variables.email}!`
      showSuccess(message, 7000)

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
      setUplineSearchTerm("")
      setUplineInputValue("")
      setSelectedUplineLabel("")
      setSelectedPreInviteUserId(null)
      setSelectedPreInviteUserLabel("")
      setHasSetDefaultUpline(false)
      setNameSearchTerm("")
      setShowNameDropdown(false)
    },
    onError: (error: Error) => {
      console.error('Error inviting agent:', error)
      setErrors([error.message || 'An unexpected error occurred. Please try again.'])
    }
  })

  // Filter permission levels based on current user's admin status
  // Admins can add both agents and admins, but agents can only add agents
  const permissionLevels = isCurrentUserAdmin
    ? allPermissionLevels
    : allPermissionLevels.filter(level => level.value === 'agent')

  // Debounce name search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNameSearchTerm(nameSearchTerm)
    }, 400)
    return () => clearTimeout(timer)
  }, [nameSearchTerm])

  // Name search for pre-invite users using TanStack Query with abort signal
  const { data: nameSearchResults = [], isLoading: isNameSearching } = useQuery<SearchOption[]>({
    queryKey: queryKeys.searchPreInviteUsers(debouncedNameSearchTerm),
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/search-agents?q=${encodeURIComponent(debouncedNameSearchTerm)}&limit=10&type=pre-invite`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal, // Abort signal cancels in-flight requests
        }
      )

      if (!response.ok) {
        // Return empty results on error instead of throwing
        return []
      }

      const agents: AgentSearchResult[] = await response.json()

      if (!Array.isArray(agents)) {
        return []
      }

      return agents.map(agent => ({
        value: agent.id,
        label: `${agent.first_name} ${agent.last_name}${agent.email ? ' - ' + agent.email : ''}${agent.status === 'pre-invite' ? ' (Pre-invite)' : ''}`,
        status: agent.status
      }))
    },
    enabled: !pauseNameSearch && debouncedNameSearchTerm.length >= 2,
    staleTime: 30000,
    retry: false,
  })

  // Reset default upline flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasSetDefaultUpline(false)
      setShowNameDropdown(false)
      setNameSearchTerm("")
      setPauseNameSearch(false)
    }
  }, [isOpen])

  // Show dropdown when search results are ready
  useEffect(() => {
    if (nameSearchResults.length > 0 && nameSearchTerm.length >= 2 && !pauseNameSearch && !selectedPreInviteUserId) {
      setShowNameDropdown(true)
    } else if (nameSearchResults.length === 0 || pauseNameSearch || selectedPreInviteUserId) {
      setShowNameDropdown(false)
    }
  }, [nameSearchResults, nameSearchTerm, pauseNameSearch, selectedPreInviteUserId])

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

    inviteAgentMutation.mutate({
      ...formData,
      preInviteUserId: selectedPreInviteUserId
    })
  }

  const handleInputChange = (field: string, value: string) => {
    // Special handling for phone number - format as (XXX) XXX-XXXX but store only digits
    if (field === 'phoneNumber') {
      // Remove all non-digit characters
      const digitsOnly = value.replace(/\D/g, '')

      // Limit to 10 digits
      const limitedDigits = digitsOnly.slice(0, 10)

      // Store only digits in state (database format)
      setFormData({ ...formData, [field]: limitedDigits })
    } else {
      setFormData({ ...formData, [field]: value })
    }
  }

  // Format phone number for display as (XXX) XXX-XXXX
  const formatPhoneForDisplay = (phone: string) => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '')

    // Format based on number of digits
    if (digitsOnly.length === 0) return ''
    if (digitsOnly.length <= 3) return `(${digitsOnly}`
    if (digitsOnly.length <= 6) return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`
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
      setShowNameDropdown(false) // Hide dropdown immediately
      setPauseNameSearch(true)
      setIsLoadingPreInviteUser(true)

      // Fetch full user details via Django API
      const accessToken = await getClientAccessToken()
      if (!accessToken) {
        setErrors(['No access token available'])
        setPauseNameSearch(false)
        setShowNameDropdown(false)
        setIsLoadingPreInviteUser(false)
        setLoading(false)
        return
      }

      const response = await fetch(`/api/agents/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('Error fetching user:', response.status)
        setErrors([`Failed to load user data: HTTP ${response.status}`])
        setPauseNameSearch(false)
        setShowNameDropdown(false)
        setIsLoadingPreInviteUser(false)
        setLoading(false)
        return
      }

      const user = await response.json()

      if (!user) {
        console.error('No user data returned')
        setErrors(['Failed to load user data: User not found'])
        setPauseNameSearch(false)
        setShowNameDropdown(false)
        setIsLoadingPreInviteUser(false)
        setLoading(false)
        return
      }

      // Set all state updates together
      // Set the label first so UI has data to display
      setSelectedPreInviteUserLabel(selectedOption.label)
      setNameSearchTerm(selectedOption.label)

      // Set form data
      setFormData({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        email: user.email || "",
        phoneNumber: user.phone_number || "",
        permissionLevel: user.perm_level || "",
        uplineAgentId: user.upline_id || "",
        positionId: user.position_id || ""
      })

      // Set selected ID and clear loading state
      setSelectedPreInviteUserId(userId)
      setIsLoadingPreInviteUser(false)
      setLoading(false)

      // If there's an upline, set the search term for upline field
      if (user.upline_id) {
        const uplineOption = uplineSearchResults.find(r => r.value === user.upline_id)
        if (uplineOption) {
          applyUplineSelection(uplineOption)
        }
      }
    } catch (error) {
      console.error('Error selecting pre-invite user:', error)
      setErrors([`Failed to load user data: ${error instanceof Error ? error.message : 'Unknown error'}`])
      setPauseNameSearch(false)
      setShowNameDropdown(false)
      setIsLoadingPreInviteUser(false)
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
                  const newValue = e.target.value
                  setPauseNameSearch(false)
                  setNameSearchTerm(newValue)
                  setShowNameDropdown(true)
                  // Clear selection if user changes search
                  if (selectedPreInviteUserId) {
                    setSelectedPreInviteUserId(null)
                    setSelectedPreInviteUserLabel("")
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
                onFocus={() => {
                  if (nameSearchTerm.length >= 2 && !pauseNameSearch) {
                    setShowNameDropdown(true)
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
            {showNameDropdown && nameSearchTerm.length >= 2 && !pauseNameSearch && nameSearchResults.length > 0 && (
              <div className="border border-border rounded-lg bg-card shadow-lg max-h-60 overflow-y-auto z-10">
                {nameSearchResults.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-accent/50 border-b border-border last:border-b-0 transition-colors"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handlePreInviteUserSelect(option.value, option)
                    }}
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
            {(selectedPreInviteUserId || isLoadingPreInviteUser) && (
              <div className="mt-2 p-2 bg-blue-500/20 rounded border border-blue-500/30">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-400">
                    {isLoadingPreInviteUser ? (
                      <>Loading user data...</>
                    ) : (
                      <>Updating existing user: {selectedPreInviteUserLabel || `${formData.firstName} ${formData.lastName}`}</>
                    )}
                  </span>
                  {!isLoadingPreInviteUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPreInviteUserId(null)
                        setSelectedPreInviteUserLabel("")
                        setNameSearchTerm("")
                        setPauseNameSearch(false)
                        setShowNameDropdown(false)
                        setIsLoadingPreInviteUser(false)
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
                  )}
                </div>
              </div>
            )}
          </div>

          {/* First Name and Last Name - Side by Side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                First name <span className="text-red-500">*</span>
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

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Last name <span className="text-red-500">*</span>
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
          </div>

          {/* Email and Phone Number - Side by Side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Phone number <span className="text-red-500">*</span>
              </label>
              <Input
                type="tel"
                value={formatPhoneForDisplay(formData.phoneNumber)}
                onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                className={`h-12 ${errorFields.phoneNumber ? 'border-red-500' : ''}`}
                placeholder="(000) 000-0000"
                required
              />
              {errorFields.phoneNumber && (
                <p className="text-red-500 text-sm">{errorFields.phoneNumber}</p>
              )}
            </div>
          </div>

          {/* Permission Level and Position - Side by Side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Permission Level <span className="text-red-500">*</span>
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
              <p className="text-xs text-muted-foreground">
                Only positions below your level are shown.
              </p>
            </div>
          </div>

          {/* Upline Agent Selection - Full Width */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Upline Agent (Optional)
            </label>
            <div className="relative">
              <Input
                type="text"
                value={uplineInputValue}
                readOnly={!!formData.uplineAgentId}
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
                onFocus={() => {
                  if (!formData.uplineAgentId) {
                    setPauseUplineSearch(false)
                  }
                }}
                onBlur={() => {
                  // Delay to let dropdown onClick register before auto-selecting
                  setTimeout(() => {
                    if (!formData.uplineAgentId && uplineInputValue.trim()) {
                      const exactMatch = uplineSearchResults.find(
                        (opt: SearchOption) => opt.label.toLowerCase() === uplineInputValue.trim().toLowerCase()
                      )
                      if (exactMatch) {
                        applyUplineSelection(exactMatch)
                      }
                    }
                  }, 200)
                }}
                className={`h-12 ${formData.uplineAgentId ? 'cursor-pointer' : ''} ${errorFields.uplineAgentId ? 'border-red-500' : ''}`}
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

            <p className="text-xs text-muted-foreground">
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
              disabled={inviteAgentMutation.isPending || loading}
            >
              {inviteAgentMutation.isPending ? 'Creating User...' : 'Submit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
