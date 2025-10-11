"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
}

// Interface for searchable select options
interface SearchOption {
  value: string
  label: string
}

const permissionLevels = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "agent", label: "Agent" },
  { value: "supervisor", label: "Supervisor" },
  { value: "trainee", label: "Trainee" }
]

// Custom hook for debounced agent search
function useAgentSearch() {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<SearchOption[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Debounce search functionality
  useEffect(() => {
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

        // API ROUTE CALL - This calls the secure endpoint
        const response = await fetch(`/api/search-agents?q=${encodeURIComponent(searchTerm)}&limit=10`, {
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
          label: `${agent.first_name} ${agent.last_name} - ${agent.email}`
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
  }, [searchTerm])

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
    annualGoal: "",
    permissionLevel: "",
    uplineAgentId: "",
    positionId: ""
  })
  const [isOpen, setIsOpen] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [errorFields, setErrorFields] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)

  // State for positions dropdown
  const [positions, setPositions] = useState<SearchOption[]>([])
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [positionsError, setPositionsError] = useState<string | null>(null)

  // Use the custom agent search hook
  const {
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
    searchError
  } = useAgentSearch()

  useEffect(() => {
      if(upline && isOpen) {
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
              setSearchTerm(searchQuery);
          }, 100); // Small delay to prevent race conditions

          return () => clearTimeout(timer);
      }
  }, [upline, isOpen]);

    // Auto-select upline agent when search results include the upline
  useEffect(() => {
      if(upline && searchResults.length > 0) {
          // Try to find the upline user using multiple matching strategies
          let uplineUser = null;

          // Strategy 1: Direct match with original format (case insensitive)
          uplineUser = searchResults.find(agent =>
              agent.label.toLowerCase().includes(upline.toLowerCase())
          );

          // Strategy 2: Convert and match "Last, First" -> "First Last"
          if (!uplineUser && upline.includes(',')) {
              const parts = upline.split(',').map(part => part.trim());
              if (parts.length === 2) {
                  const convertedName = `${parts[1]} ${parts[0]}`;
                  uplineUser = searchResults.find(agent =>
                      agent.label.toLowerCase().includes(convertedName.toLowerCase())
                  );
              }
          }

          // Strategy 3: Match individual name parts
          if (!uplineUser) {
              const nameParts = upline.includes(',')
                  ? upline.split(',').map(part => part.trim())
                  : upline.split(' ').map(part => part.trim());

              uplineUser = searchResults.find(agent => {
                  const agentLabel = agent.label.toLowerCase();
                  return nameParts.every(part =>
                      part.length > 1 && agentLabel.includes(part.toLowerCase())
                  );
              });
          }

          if(uplineUser && !formData.uplineAgentId) {
              setFormData(prev => ({...prev, uplineAgentId: uplineUser.value}));
          }
      }
  }, [upline, searchResults, formData.uplineAgentId]);

  // Fetch positions when component mounts
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        setPositionsLoading(true)
        setPositionsError(null)

        // API call to fetch positions
        const response = await fetch('/api/positions/all', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        })

        if (!response.ok) {
          throw new Error('Failed to fetch positions')
        }

        const positionsData: SearchOption[] = await response.json()
        setPositions(positionsData)
      } catch (error) {
        console.error('Error fetching positions:', error)
        setPositionsError('Failed to load positions. Please refresh and try again.')
      } finally {
        setPositionsLoading(false)
      }
    }

    if(isOpen) {
        fetchPositions()
    }
  }, [isOpen])

  const validateForm = () => {
    const newErrors: string[] = []
    const newErrorFields: Record<string, string> = {}

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      newErrors.push("Invalid email format")
      newErrorFields.email = "Invalid email format"
    }

    // Phone validation (simple format: xxx-xxx-xxxx)
    if (formData.phoneNumber.length != 10) {
      newErrors.push("Phone number must be in format: xxx-xxx-xxxx")
      newErrorFields.phoneNumber = "Invalid phone format"
    }

    // Annual goal validation
    if (isNaN(Number(formData.annualGoal)) || Number(formData.annualGoal) < 0) {
      newErrors.push("Annual goal must be a positive number")
      newErrorFields.annualGoal = "Invalid number"
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

      // Single API call with all user data including upline agent ID and position ID
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phoneNumber: formData.phoneNumber,
          annualGoal: Number(formData.annualGoal),
          permissionLevel: formData.permissionLevel,
          positionId: formData.positionId || null, // Include position ID
          uplineAgentId: formData.uplineAgentId || null // Include upline agent ID
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        console.log(response)
        throw new Error(data.error || 'Failed to create user')
      }

      setIsOpen(false)
      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        annualGoal: "",
        permissionLevel: "",
        uplineAgentId: "",
        positionId: ""
      })
      setErrors([])
      setErrorFields({})
      setSearchTerm("") // Reset search term
    } catch (error) {
      console.error('Error creating user:', error)
      setErrors(['Failed to create user. Please try again.'])
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto add-user-modal">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground mb-6">Add a User</DialogTitle>
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
        {searchError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{searchError}</AlertDescription>
          </Alert>
        )}

        {/* Show positions error if any */}
        {positionsError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{positionsError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* First name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              First name
            </label>
            <Input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              className={`h-12 ${errorFields.firstName ? 'border-red-500' : ''}`}
              required
            />
            {errorFields.firstName && (
              <p className="text-red-500 text-sm">{errorFields.firstName}</p>
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
              className="h-12"
              required
            />
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

          {/* Annual goal */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Annual goal
            </label>
            <Input
              type="number"
              value={formData.annualGoal}
              onChange={(e) => handleInputChange("annualGoal", e.target.value)}
              className="h-12"
              placeholder="0"
            />
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
              placeholder="--------"
              searchPlaceholder="Search permission levels..."
            />
          </div>

          {/* Position Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Position
            </label>
            {positionsLoading ? (
              <div className="h-12 border border-border rounded-lg flex items-center justify-center bg-accent/50">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm text-muted-foreground">Loading positions...</span>
                </div>
              </div>
            ) : positionsError ? (
              <div className="h-12 border border-destructive rounded-lg flex items-center justify-center bg-destructive/10">
                <span className="text-sm text-destructive">Failed to load positions</span>
              </div>
            ) : (
              <SimpleSearchableSelect
                options={positions}
                value={formData.positionId}
                onValueChange={(value) => handleInputChange("positionId", value)}
                placeholder="Select a position..."
                searchPlaceholder="Search positions..."
              />
            )}
          </div>

          {/* Upline Agent Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Upline Agent (Optional)
            </label>
            <div className="relative">
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12"
                placeholder="Type to search for upline agent..."
              />
              {/* Loading indicator */}
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                </div>
              )}
            </div>

            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <div className="border border-border rounded-lg bg-card shadow-lg max-h-60 overflow-y-auto z-10">
                {searchResults.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-accent/50 border-b border-border last:border-b-0 transition-colors"
                    onClick={() => {
                      handleUplineAgentChange(option.value)
                      setSearchTerm(option.label) // Set the display text
                    }}
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
                    Selected: {searchResults.find(r => r.value === formData.uplineAgentId)?.label || 'Agent selected'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      handleUplineAgentChange("")
                      setSearchTerm("")
                    }}
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
