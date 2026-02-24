"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { useAuth } from "@/providers/AuthProvider"
import { Loader2, CheckCircle2, Circle, ArrowRight, ArrowLeft, FileText, User, ClipboardCheck, Plus, Trash2, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNotification } from "@/contexts/notification-context"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queryKeys'
import { formatPhoneInput, normalizePhoneForStorage } from "@/lib/telnyx"

// Options are loaded dynamically from Supabase based on the user's agency

const initialFormData = {
  carrierId: "",
  productId: "",
  policyEffectiveDate: "",
  ssnBenefit: "",
  billingDayOfMonth: "",
  billingWeekday: "",
  monthlyPremium: "",
  billingCycle: "",
  leadSource: "",
  clientFirstName: "",
  clientLastName: "",
  clientEmail: "",
  clientPhone: "",
  clientDateOfBirth: "",
  clientAddress: "",
  policyNumber: "",
  applicationNumber: "",
  team: "",
  notes: "",
  rateClass: "",
  coverageAmount: "",
  submittedDate: "",
};

type Beneficiary = {
  id: string;
  name: string;
  relationship: string;
};

type FormField = keyof typeof initialFormData;

const STEPS = [
  { id: 1, name: 'Policy Information', icon: FileText },
  { id: 2, name: 'Client Information', icon: User },
  { id: 3, name: 'Review & Submit', icon: ClipboardCheck }
]

export default function PostDeal() {
  const [formData, setFormData] = useState<typeof initialFormData>(initialFormData)
  const { user } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { showSuccess, showError, showWarning } = useNotification()

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const submitIntentRef = useRef(false)

  // Dynamic option states
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])

  // Address autocomplete states
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{display_name: string, address: any}>>([])
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)
  const [addressSearchTimeout, setAddressSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  const addressInputRef = useRef<HTMLInputElement>(null)

  // Billing cycle options (fixed enum)
  const billingCycleOptions = [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "semi-annually", label: "Semi-Annually" },
    { value: "annually", label: "Annually" },
  ]

  // Rate class options
  const rateClassOptions = [
    { value: "Preferred", label: "Preferred" },
    { value: "Standard", label: "Standard" },
    { value: "Sub-Standard", label: "Sub-Standard" },
    { value: "Graded", label: "Graded" },
    { value: "Modified", label: "Modified" },
    { value: "Guaranteed Issue", label: "Guaranteed Issue" },
  ]

  // Billing day of month options
  const billingDayOfMonthOptions = [
    { value: "1st", label: "1st" },
    { value: "2nd", label: "2nd" },
    { value: "3rd", label: "3rd" },
    { value: "4th", label: "4th" },
  ]

  // Billing weekday options
  const billingWeekdayOptions = [
    { value: "Monday", label: "Monday" },
    { value: "Tuesday", label: "Tuesday" },
    { value: "Wednesday", label: "Wednesday" },
    { value: "Thursday", label: "Thursday" },
    { value: "Friday", label: "Friday" },
  ]

  // SSN benefit options
  const ssnBenefitOptions = [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ]

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [error])

  // Initialize submitted date to today
  useEffect(() => {
    setFormData(prev => ({ ...prev, submittedDate: prev.submittedDate || today }))
  }, [today])

  // Query: Check if user and upline have positions assigned
  const { data: positionCheckData, isLoading: positionCheckLoading } = useQuery({
    queryKey: queryKeys.positionsCheck(user?.id || ''),
    queryFn: async () => {
      if (!user?.id) return null

      const response = await fetch('/api/agents/check-positions', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        return {
          hasAllPositions: data.hasAllPositions,
          missingPositions: data.missingPositions || []
        }
      } else {
        console.error('Failed to check positions')
        return {
          hasAllPositions: false,
          missingPositions: []
        }
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const hasAllPositions = positionCheckData?.hasAllPositions ?? false
  const missingPositions = positionCheckData?.missingPositions ?? []

  // Query: Load user's agency and initial options via Django API
  const { data: agencyData } = useQuery({
    queryKey: queryKeys.agencyOptions(user?.id || ''),
    queryFn: async () => {

      if (!user?.id) {
        return null
      }

      const response = await fetch('/api/deals/form-data', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        console.error('[PostDeal AgencyQuery] Error fetching form data:', response.statusText)
        return null
      }

      const data = await response.json()

      // Django returns carriers/products as {id, name, displayName} objects.
      // After camelcaseKeys transform they become {id, name, displayName}.
      // Map them to {value, label} as required by SimpleSearchableSelect.
      const rawCarriers: Array<{ id: string; name: string; displayName?: string }> = data.carriers || []
      const rawLeadSources: Array<{ value?: string; label?: string; id?: string; name?: string }> = data.leadSources || []
      const rawTeams: Array<{ value?: string; label?: string; id?: string; name?: string }> = data.teams || []

      return {
        userId: data.userId,
        agencyId: data.agencyId,
        isAdminUser: data.isAdmin,
        leadSourceOptions: rawLeadSources.map(ls =>
          ls.value !== undefined
            ? { value: ls.value, label: ls.label ?? ls.name ?? String(ls.value) }
            : { value: String(ls.id), label: ls.name ?? String(ls.id) }
        ),
        carriersOptions: rawCarriers.map(c => ({
          value: String(c.id),
          label: c.displayName || c.name,
        })),
        userFirstName: data.userFirstName,
        userLastName: data.userLastName,
        deactivatedPostADeal: data.deactivatedPostADeal || false,
        teamsOptions: rawTeams.map(t =>
          t.value !== undefined
            ? { value: t.value, label: t.label ?? t.name ?? String(t.value) }
            : { value: String(t.id), label: t.name ?? String(t.id) }
        ),
        beneficiariesRequired: data.beneficiariesRequired ?? false
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const userId = agencyData?.userId ?? null
  const agencyId = agencyData?.agencyId ?? null
  const isAdminUser = agencyData?.isAdminUser ?? false
  const leadSourceOptions = agencyData?.leadSourceOptions ?? []
  const carriersOptions = agencyData?.carriersOptions ?? []
  const userFirstName = agencyData?.userFirstName ?? ''
  const userLastName = agencyData?.userLastName ?? ''
  const deactivatedPostADeal = agencyData?.deactivatedPostADeal ?? false
  const teamsOptions = agencyData?.teamsOptions ?? []
  const beneficiariesRequired = agencyData?.beneficiariesRequired ?? false

  const hasTeams = teamsOptions.length > 0

  // Dynamic required fields based on agency settings
  const requiredFields: FormField[] = useMemo(() => {
    const baseFields: FormField[] = [
      "carrierId", "productId", "policyEffectiveDate", "ssnBenefit", "monthlyPremium",
      "billingCycle", "leadSource",
      "clientFirstName", "clientLastName", "clientEmail", "clientPhone", "clientDateOfBirth",
      "clientAddress", "policyNumber"
    ]
    if (hasTeams) {
      baseFields.push("team")
    }
    return baseFields
  }, [hasTeams])

  // Query: Load products when carrier changes via Django API
  const { data: productsOptions = [], isFetching: isProductsFetching } = useQuery({
    queryKey: queryKeys.productsByCarrier(agencyId || '', formData.carrierId),
    queryFn: async () => {
      if (!agencyId || !formData.carrierId) {
        return []
      }

      const response = await fetch(`/api/deals/products-by-carrier?carrier_id=${formData.carrierId}`, {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        console.error('Failed to fetch products by carrier')
        return []
      }

      const products: Array<{ id: string; name: string; displayName?: string }> = await response.json()
      // Django returns products as {id, name, displayName} objects.
      // After camelcaseKeys transform they become {id, name, displayName}.
      // Map them to {value, label} as required by SimpleSearchableSelect.
      return products.map(p => ({
        value: String(p.id),
        label: p.displayName || p.name,
      }))
    },
    enabled: !!agencyId && !!formData.carrierId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const sendDiscordNotification = async (
    agencyId: string,
    agentId: string,
    agentFirstName: string,
    agentLastName: string,
    formData: typeof initialFormData,
    monthlyPremium: number
  ) => {
    try {
      // Use cached agent name - no need to query again!
      const agentName = `${agentFirstName} ${agentLastName}`
      const carrierName = getCarrierName(formData.carrierId)
      const productName = getProductName(formData.productId)
      const annualPremium = (monthlyPremium * 12).toFixed(2)

      // Send template variables to webhook API
      const response = await fetch('/api/discord/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agencyId,
          placeholders: {
            agent_name: agentName,
            carrier_name: carrierName,
            product_name: productName,
            monthly_premium: monthlyPremium.toFixed(2),
            annual_premium: annualPremium,
            client_name: `${formData.clientFirstName} ${formData.clientLastName}`.trim(),
            policy_number: formData.policyNumber,
            effective_date: formData.policyEffectiveDate,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[Discord] Webhook API error:', errorData)
      }
    } catch (error) {
      // Ignore AbortError from page navigation - notification likely sent successfully
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      // Log other errors but don't throw - we don't want to fail the deal submission
      console.error('[Discord] Error sending notification:', error instanceof Error ? error.message : String(error))
    }
  }

  // Mutation: Submit deal
  const submitDealMutation = useMutation({
    mutationFn: async () => {

      // SECTION 1: Get current user's agent_id from cached data
      if (!user?.id) {
        console.error('[PostDeal] ERROR: User not authenticated')
        throw new Error("User not authenticated. Please log in again.")
      }

      // Ensure agency_id is loaded
      if (!agencyId) {
        console.error('[PostDeal] ERROR: Agency ID not loaded')
        throw new Error("Agency information not loaded. Please refresh the page and try again.")
      }

      // Use cached user ID from agencyData query instead of querying again
      if (!userId) {
        console.error('[PostDeal] ERROR: User ID not available from cache')
        throw new Error("User information not loaded. Please refresh the page and try again.")
      }

      const agentId = userId

      // SECTION 2: Use selected IDs directly
      const carrierId = formData.carrierId
      const productId = formData.productId

      // SECTION 3: Invite client if email is provided
      let clientId = null
      let invitationMessage = ''

      if (formData.clientEmail) {
        try {
          // Call the invite API directly - it handles checking for existing clients

          // Add timeout to invitation API call
          const inviteController = new AbortController()
          const inviteTimeoutId = setTimeout(() => {
            console.error('[PostDeal] Client invitation timeout triggered')
            inviteController.abort()
          }, 15000) // 15 second timeout

          let inviteResponse
          try {
            // Strip formatting from phone number for invite API
            const cleanPhoneForInvite = formData.clientPhone
              ? formData.clientPhone.replace(/[^\d]/g, '')
              : undefined

            inviteResponse = await fetch('/api/clients/invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: formData.clientEmail,
                firstName: formData.clientFirstName,
                lastName: formData.clientLastName || 'Client',
                phoneNumber: cleanPhoneForInvite
              }),
              signal: inviteController.signal
            })
            clearTimeout(inviteTimeoutId)
          } catch (inviteFetchError: any) {
            clearTimeout(inviteTimeoutId)
            if (inviteFetchError.name === 'AbortError') {
              console.error('[PostDeal] Client invitation request timed out after 15 seconds')
              invitationMessage = 'Email unable to send. Please try manually from Book of Business.'
              inviteResponse = null
            } else {
              console.error('[PostDeal] Client invitation fetch error:', inviteFetchError)
              invitationMessage = 'Email unable to send. Please try manually from Book of Business.'
              inviteResponse = null
            }
          }

          if (inviteResponse) {
            const inviteData = await inviteResponse.json()

            if (inviteResponse.ok && inviteData.success) {
              clientId = inviteData.userId
              invitationMessage = inviteData.alreadyExists
                ? 'Client invitation was previously sent.'
                : '✓ Invitation email sent to client successfully!'
            } else {
              const errorMsg = inviteData.error || 'Unknown error'
              console.error('[PostDeal] Failed to invite client:', errorMsg)
              invitationMessage = 'Email unable to send. Please try manually from Book of Business.'
            }
          }
        } catch (clientError) {
          console.error('[PostDeal] Error in client invitation process:', clientError)
          invitationMessage = 'Email unable to send. Please try manually from Book of Business.'
        }
      } else {
        invitationMessage = 'No client email provided - client will not receive portal access.'
      }


      const normalizedBeneficiaries = beneficiaries
        .filter(b =>
      b.name.trim() ||
          b.relationship.trim()
        )
        .map(b => {
          return {
            name: b.name.trim(),
            relationship: b.relationship.trim() || null,
            allocationPercentage: null,
          }
        })

      // SECTION 4: Construct payload and submit to API
      const monthlyPremium = parseFloat(formData.monthlyPremium)

      // Strip formatting from phone number - remove parentheses, spaces, and dashes
      const cleanPhoneNumber = formData.clientPhone
        ? formData.clientPhone.replace(/[^\d]/g, '')
        : null

      const payload = {
        agentId,
        carrierId,
        productId,
        clientId,
        agencyId: agencyId,
        clientName: `${formData.clientFirstName} ${formData.clientLastName}`.trim(),
        clientEmail: formData.clientEmail || null,
        clientPhone: cleanPhoneNumber,
        dateOfBirth: formData.clientDateOfBirth || null,
        ssnLast4: null,
        clientAddress: formData.clientAddress || null,
        policyNumber: formData.policyNumber,
        applicationNumber: formData.applicationNumber || null,
        monthlyPremium: monthlyPremium,
        annualPremium: monthlyPremium * 12,
        policyEffectiveDate: formData.policyEffectiveDate,
        ssnBenefit: formData.ssnBenefit === "yes",
        billingDayOfMonth: formData.ssnBenefit === "yes" ? formData.billingDayOfMonth : null,
        billingWeekday: formData.ssnBenefit === "yes" ? formData.billingWeekday : null,
        billingCycle: formData.billingCycle || null,
        leadSource: formData.leadSource || null,
        beneficiaries: normalizedBeneficiaries,
        team: formData.team || null,
        notes: formData.notes || null,
        rateClass: formData.rateClass || null,
        submissionDate: formData.submittedDate || today,
        faceValue: formData.coverageAmount ? parseFloat(formData.coverageAmount) : null,
        postADeal: true,
      }


      // Add timeout to prevent infinite hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.error('[PostDeal] Request timeout triggered after 30 seconds')
        controller.abort()
      }, 30000) // 30 second timeout

      let res
      try {
        res = await fetch("/api/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        })
        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        console.error('[PostDeal] Fetch threw an error:', fetchError)
        if (fetchError.name === 'AbortError') {
          console.error('[PostDeal] Request timed out after 30 seconds')
          throw new Error("Request timed out. Please try again.")
        }
        console.error('[PostDeal] Fetch error:', fetchError)
        throw new Error("Network error. Please check your connection and try again.")
      }

      let data: any
      try {
        const responseText = await res.text()
        data = JSON.parse(responseText)
      } catch {
        console.error('[PostDeal] Non-JSON response from server')
        throw new Error(res.status >= 500 ? "Server error. Please try again in a moment." : `Unexpected response (${res.status})`)
      }

      if (!res.ok) {
        console.error('[PostDeal] Response not OK, throwing error')
        throw new Error(data.error || "Failed to submit deal.")
      }

      // Success: show appropriate message based on operation
      let successMessage = ''
      if (data.operation === 'updated') {
        successMessage = "Deal updated successfully! This policy already existed and has been updated with your additional information."
      } else {
        successMessage = "Deal created successfully!"
      }

      // Add invitation status to the message
      if (invitationMessage) {
        successMessage += '\n\n' + invitationMessage
      }


      // Send Discord notification (don't block on this - fire and forget)
      sendDiscordNotification(agencyId, agentId, userFirstName, userLastName, formData, monthlyPremium)

      return successMessage
    },
    onSuccess: (successMessage) => {
      // Invalidate deals cache so the book of business shows the new deal
      queryClient.invalidateQueries({ queryKey: queryKeys.deals })
      queryClient.invalidateQueries({ queryKey: ['deals', 'book-of-business'] })

      // Check if invitation failed and show appropriate notifications
      if (successMessage.includes('Email unable to send')) {
        // Show success for deal creation
        const dealMessage = successMessage.split('\n\n')[0]
        showSuccess(dealMessage, 5000)
        // Show warning for email failure
        showWarning('Email unable to send. Please send invitation manually from Book of Business.', 7000)
      } else {
        // Show combined success message
        showSuccess(successMessage, 7000)
      }

      setBeneficiaries([])

      // Use window.location instead of router.push to force a full page reload
      // This ensures the book of business page loads fresh data
      window.location.href = "/policies/book"
    },
    onError: (error: Error) => {
      console.error('[PostDeal] onError callback triggered:', error)
      setError(error.message || "An unexpected error occurred.")
    },
    onSettled: () => {
      submitIntentRef.current = false
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Only submit if we're on the final step
    if (currentStep !== STEPS.length) {
      submitIntentRef.current = false
      return
    }

    // Require explicit submit intent (button click)
    if (!submitIntentRef.current) {
      return
    }

    if (!validateForm()) {
      submitIntentRef.current = false
      return
    }

    setError(null)
    submitDealMutation.mutate()
  }

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter") {
      // Block Enter from submitting; require explicit click on Submit button
      e.preventDefault()
    }
  }

  // Use centralized phone formatting from telnyx.ts
  const formatPhoneNumber = formatPhoneInput

  // Search for address suggestions using Nominatim (free, no API key needed)
  const searchAddress = async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([])
      setShowAddressSuggestions(false)
      return
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=us&limit=5`,
        {
          headers: {
            'User-Agent': 'AgentSpace-App'
          }
        }
      )
      const data = await response.json()
      setAddressSuggestions(data)
      setShowAddressSuggestions(data.length > 0)
    } catch (error) {
      console.error('Address search error:', error)
      setAddressSuggestions([])
      setShowAddressSuggestions(false)
    }
  }

  // Handle address input change with debouncing
  const handleAddressChange = (value: string) => {
    setFormData({ ...formData, clientAddress: value })

    // Clear existing timeout
    if (addressSearchTimeout) {
      clearTimeout(addressSearchTimeout)
    }

    // Set new timeout for search
    const timeout = setTimeout(() => {
      searchAddress(value)
    }, 300) // 300ms debounce

    setAddressSearchTimeout(timeout)
  }

  // Select an address suggestion
  const selectAddress = (suggestion: any) => {
    setFormData({ ...formData, clientAddress: suggestion.display_name })
    setShowAddressSuggestions(false)
    setAddressSuggestions([])
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addressInputRef.current && !addressInputRef.current.contains(event.target as Node)) {
        setShowAddressSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (field: string, value: string) => {
    // For monthly premium, allow any string (including empty, partial numbers)
    if (field === "monthlyPremium") {
      // Don't allow negative sign as the first character
      if (value.startsWith("-")) return
      setFormData({ ...formData, [field]: value })
      return
    }
    // For coverage amount, prevent negative values
    if (field === "coverageAmount") {
      if (value.startsWith("-")) return
      setFormData({ ...formData, [field]: value })
      return
    }
    // Reset productId when carrier changes to prevent stale product selection
    if (field === "carrierId") {
      setFormData(prev => ({ ...prev, carrierId: value, productId: "" }))
      return
    }
    // Format phone number input
    if (field === "clientPhone") {
      const formatted = formatPhoneNumber(value)
      setFormData({ ...formData, [field]: formatted })
      return
    }
    setFormData({ ...formData, [field]: value })
  }

  const generateBeneficiaryId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  const addBeneficiary = () => {
    setBeneficiaries(prev => [
      ...prev,
      {
        id: generateBeneficiaryId(),
        name: "",
        relationship: "",
      },
    ])
  }

  const handleBeneficiaryChange = (id: string, field: keyof Omit<Beneficiary, "id">, value: string) => {
    setBeneficiaries(prev => prev.map(b => (b.id === id ? { ...b, [field]: value } : b)))
  }

  const removeBeneficiary = (id: string) => {
    setBeneficiaries(prev => prev.filter(b => b.id !== id))
  }

  const validateForm = () => {
    // Required fields
    for (const field of requiredFields) {
      if (!formData[field]) {
        setError("Please fill out all required fields.")
        return false
      }
    }
    // Premium check (monthly premium must be a valid non-negative number)
    const monthly = parseFloat(formData.monthlyPremium)
    if (Number.isNaN(monthly) || monthly < 0) {
      setError("Please enter a valid monthly premium.")
      return false
    }
    setError(null)
    return true
  }

  const validateStep = (step: number) => {
    setError(null)

    if (step === 1) {
      // Policy Information validation
      if (!formData.carrierId) {
        setError("Please select a carrier.")
        return false
      }
      if (!formData.productId) {
        setError("Please select a product.")
        return false
      }
      if (!formData.policyEffectiveDate) {
        setError("Please select a policy effective date.")
        return false
      }
      if (!formData.ssnBenefit) {
        setError("Please select whether this policy has SSN benefit.")
        return false
      }
      // Only require billing pattern fields if SSN benefit is "yes"
      if (formData.ssnBenefit === "yes") {
        if (!formData.billingDayOfMonth) {
          setError("Please select the week of month for billing.")
          return false
        }
        if (!formData.billingWeekday) {
          setError("Please select the day of week for billing.")
          return false
        }
      }
      if (!formData.monthlyPremium) {
        setError("Please enter the monthly premium.")
        return false
      }
      const monthly = parseFloat(formData.monthlyPremium)
      if (Number.isNaN(monthly) || monthly < 0) {
        setError("Please enter a valid monthly premium.")
        return false
      }
      if (!formData.rateClass) {
        setError("Please select a rate class.")
        return false
      }
      // At least one of policy number or application number must be filled
      if (!formData.policyNumber && !formData.applicationNumber) {
        setError("Please enter either a policy number or an application number.")
        return false
      }
      if (!formData.billingCycle) {
        setError("Please select a billing cycle.")
        return false
      }
      if (!formData.leadSource) {
        setError("Please select a lead source.")
        return false
      }
      if (hasTeams && !formData.team) {
        setError("Please select a team.")
        return false
      }
    } else if (step === 2) {
      // Client Information validation
      if (!formData.clientFirstName) {
        setError("Please enter the client's first name.")
        return false
      }
      if (!formData.clientLastName) {
        setError("Please enter the client's last name.")
        return false
      }
      if (!formData.clientEmail) {
        setError("Please enter the client's email address.")
        return false
      }
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.clientEmail)) {
        setError("Please enter a valid email address.")
        return false
      }
      if (!formData.clientPhone) {
        setError("Please enter the client's phone number.")
        return false
      }
      // Validate phone number format (must be 10 digits)
      const phoneDigits = normalizePhoneForStorage(formData.clientPhone)
      if (phoneDigits.length !== 10) {
        setError("Please enter a valid 10-digit phone number.")
        return false
      }
      if (!formData.clientDateOfBirth) {
        setError("Please enter the client's date of birth.")
        return false
      }
      if (!formData.clientAddress) {
        setError("Please enter the client's address.")
        return false
      }
      // Validate beneficiaries based on agency settings
      const validBeneficiaries = beneficiaries.filter(b => b.name.trim() && b.relationship.trim())
      const incompleteBeneficiaries = beneficiaries.filter(b =>
        (b.name.trim() && !b.relationship.trim()) || (!b.name.trim() && b.relationship.trim())
      )

      if (beneficiariesRequired && validBeneficiaries.length === 0) {
        setError("Please add at least one beneficiary with both name and relationship.")
        return false
      }

      if (incompleteBeneficiaries.length > 0) {
        setError("Each beneficiary must have both name and relationship filled in.")
        return false
      }
    }

    return true
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getCarrierName = (id: string) => {
    return carriersOptions.find((c: { value: string; label: string }) => c.value === id)?.label || id
  }

  const getProductName = (id: string) => {
    return productsOptions.find((p: { value: string; label: string }) => p.value === id)?.label || id
  }

  const activeBeneficiaries = beneficiaries.filter(b =>
    b.name.trim() || b.relationship.trim()
  )

  return (
    <div className="space-y-8 max-w-5xl mx-auto post-deal-content" data-tour="post-deal">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Post a Deal</h1>
        <p className="text-muted-foreground">Submit a new policy in {STEPS.length} easy steps</p>
      </div>

      {/* Position Check Loading */}
      {positionCheckLoading && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              <p className="text-sm text-foreground">
                Verifying position assignments...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deactivated Post a Deal Check */}
      {deactivatedPostADeal && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Circle className="h-5 w-5 fill-current" />
              Post a Deal Disabled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              Posting deals has been disabled for your agency. Please contact your agency administrator for more information.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Position Check Error */}
      {!positionCheckLoading && !hasAllPositions && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Circle className="h-5 w-5 fill-current" />
              Position Assignment Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">
              {isAdminUser
                ? "Please assign your position to yourself on the profile page."
                : "You or your uplines don't have positions set. Position assignments are required before you can post deals. Please contact your upline or agency owner to have your position assigned."}
            </p>
            {missingPositions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Missing Positions:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                  {missingPositions.map((agent: any) => (
                    <li key={agent.agentId}>
                      {agent.firstName} {agent.lastName} ({agent.email})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isAdminUser && (
              <div className="pt-2">
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  onClick={() => router.push('/user/profile')}
                >
                  Go to Profile
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Only show form if positions are valid and post a deal is not deactivated */}
      {!positionCheckLoading && hasAllPositions && !deactivatedPostADeal && (
        <>
          {/* Progress Stepper */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon
            const isCompleted = currentStep > step.id
            const isCurrent = currentStep === step.id

            return (
              <div key={step.id} className="flex-1 relative">
                <div className="flex flex-col items-center">
                  {/* Circle with Icon */}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative z-10",
                      isCompleted && "bg-primary border-primary text-primary-foreground",
                      isCurrent && "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/50",
                      !isCompleted && !isCurrent && "bg-card border-border text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <StepIcon className="h-6 w-6" />
                    )}
                  </div>

                  {/* Step Label */}
                  <div className="mt-3 text-center">
                    <div className={cn(
                      "text-sm font-medium transition-colors",
                      (isCurrent || isCompleted) ? "text-foreground" : "text-muted-foreground"
                    )}>
                      Step {step.id}
                    </div>
                    <div className={cn(
                      "text-xs mt-1 transition-colors",
                      (isCurrent || isCompleted) ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {step.name}
                    </div>
                  </div>
                </div>

                {/* Connector Line */}
                {index < STEPS.length - 1 && (
                  <div
                    className="absolute top-6 left-1/2 w-full h-0.5 -z-0"
                    style={{ transform: 'translateY(-50%)' }}
                  >
                    <div className={cn(
                      "h-full transition-all duration-300",
                      isCompleted ? "bg-primary" : "bg-border"
                    )} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          ref={errorRef}
          className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/30"
        >
          {error}
        </div>
      )}

      {/* Form */}
      <Card className="professional-card">
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-8">
            {/* Step 1: Policy Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="border-b border-border pb-4">
                  <h2 className="text-2xl font-bold text-foreground">Policy Information</h2>
                  <p className="text-sm text-muted-foreground mt-1">Enter the details of the policy you're submitting</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Carrier */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Carrier <span className="text-destructive">*</span>
                    </label>
                    <SimpleSearchableSelect
                      options={carriersOptions}
                      value={formData.carrierId}
                      onValueChange={(value) => handleInputChange("carrierId", value)}
                    />
                  </div>

                  {/* Product */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Product <span className="text-destructive">*</span>
                    </label>
                    <SimpleSearchableSelect
                      options={productsOptions}
                      value={formData.productId}
                      onValueChange={(value) => handleInputChange("productId", value)}
                      disabled={isProductsFetching}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Policy Effective / Draft Date */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Policy Effective Date <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formData.policyEffectiveDate}
                      onChange={(e) => handleInputChange("policyEffectiveDate", e.target.value)}
                      className="h-12"
                    />
                  </div>

                  {/* Premium Field */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Monthly Premium <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.monthlyPremium}
                      onChange={(e) => handleInputChange("monthlyPremium", e.target.value)}
                      className="h-12"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Rate Class */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Rate Class <span className="text-destructive">*</span>
                    </label>
                    <SimpleSearchableSelect
                      options={rateClassOptions}
                      value={formData.rateClass}
                      onValueChange={(value) => handleInputChange("rateClass", value)}
                      placeholder="Select rate class"
                    />
                  </div>

                  {/* Coverage Amount */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Coverage Amount
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.coverageAmount}
                      onChange={(e) => handleInputChange("coverageAmount", e.target.value)}
                      className="h-12"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* SSN Benefit */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      SSN Benefit <span className="text-destructive">*</span>
                    </label>
                    <SimpleSearchableSelect
                      options={ssnBenefitOptions}
                      value={formData.ssnBenefit}
                      onValueChange={(value) => handleInputChange("ssnBenefit", value)}
                      placeholder="Select yes or no"
                    />
                    <p className="text-xs text-muted-foreground">
                      If yes, you&apos;ll need to specify the billing date pattern below
                    </p>
                  </div>
                </div>

                {/* Billing Date Pattern - Only shown when SSN Benefit is "yes" */}
                {formData.ssnBenefit === "yes" && (
                  <div className="border border-border rounded-lg p-4 bg-card/50 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Billing Date Pattern</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Specify when billing occurs each period (e.g., 2nd Wednesday means billing happens on the 2nd Wednesday of each billing cycle)
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-foreground">
                          Week of Month <span className="text-destructive">*</span>
                        </label>
                        <SimpleSearchableSelect
                          options={billingDayOfMonthOptions}
                          value={formData.billingDayOfMonth}
                          onValueChange={(value) => handleInputChange("billingDayOfMonth", value)}
                          placeholder="Select week"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-foreground">
                          Day of Week <span className="text-destructive">*</span>
                        </label>
                        <SimpleSearchableSelect
                          options={billingWeekdayOptions}
                          value={formData.billingWeekday}
                          onValueChange={(value) => handleInputChange("billingWeekday", value)}
                          placeholder="Select day"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Policy Number */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Policy Number
                    </label>
                    <Input
                      type="text"
                      value={formData.policyNumber}
                      onChange={(e) => handleInputChange("policyNumber", e.target.value)}
                      className="h-12"
                      placeholder="Enter policy number"
                    />
                  </div>

                  {/* Application Number */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Application Number
                    </label>
                    <Input
                      type="text"
                      value={formData.applicationNumber}
                      onChange={(e) => handleInputChange("applicationNumber", e.target.value)}
                      className="h-12"
                      placeholder="Enter application number"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-4">
                  <span className="text-destructive">*</span> At least one is required: Enter the policy number if available, otherwise enter the application number
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Billing Cycle */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Billing Cycle <span className="text-destructive">*</span>
                    </label>
                    <SimpleSearchableSelect
                      options={billingCycleOptions}
                      value={formData.billingCycle}
                      onValueChange={(value) => handleInputChange("billingCycle", value)}
                      placeholder="Select billing cycle"
                    />
                  </div>

                  {/* Lead Source */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Lead Source <span className="text-destructive">*</span>
                    </label>
                    <SimpleSearchableSelect
                      options={leadSourceOptions}
                      value={formData.leadSource}
                      onValueChange={(value) => handleInputChange("leadSource", value)}
                      placeholder="Select lead source"
                    />
                  </div>
                </div>

                {/* Team - Only shown if teams exist */}
                {teamsOptions.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Team <span className="text-destructive">*</span>
                    </label>
                    <SimpleSearchableSelect
                      options={teamsOptions}
                      value={formData.team}
                      onValueChange={(value) => handleInputChange("team", value)}
                      placeholder="Select team"
                    />
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Notes
                  </label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder={
                      agencyId === "b731a3a7-a357-468e-ad6a-50a426b3735c"
                        ? "Add any additional notes about this policy... (These notes will appear in the Discord message)"
                        : "Add any additional notes about this policy..."
                    }
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Client Information */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="border-b border-border pb-4">
                  <h2 className="text-2xl font-bold text-foreground">Client Information</h2>
                  <p className="text-sm text-muted-foreground mt-1">Provide details about your client</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      First Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.clientFirstName}
                      onChange={(e) => handleInputChange("clientFirstName", e.target.value)}
                      className="h-12"
                      placeholder="Enter client's first name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Last Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.clientLastName}
                      onChange={(e) => handleInputChange("clientLastName", e.target.value)}
                      className="h-12"
                      placeholder="Enter client's last name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Client Email <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => handleInputChange("clientEmail", e.target.value)}
                      className="h-12"
                      placeholder="Enter client email"
                    />
                    <p className="text-xs text-muted-foreground">
                      An invitation will be sent to this email for client portal access
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Client Phone <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="tel"
                      value={formData.clientPhone}
                      onChange={(e) => handleInputChange("clientPhone", e.target.value)}
                      className="h-12"
                      placeholder="(555) 123-4567"
                      maxLength={14}
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: (XXX) XXX-XXXX
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Date of Birth <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formData.clientDateOfBirth}
                      onChange={(e) => handleInputChange("clientDateOfBirth", e.target.value)}
                      className="h-12"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Submitted Date
                    </label>
                    <Input
                      type="date"
                      value={formData.submittedDate}
                      onChange={(e) => handleInputChange("submittedDate", e.target.value)}
                      max={today}
                      className="h-12"
                    />
                    <p className="text-xs text-muted-foreground">
                      Defaults to today. Change if the deal was submitted on a different date.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2 relative" ref={addressInputRef}>
                    <label className="block text-sm font-semibold text-foreground">
                      Address <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        type="text"
                        value={formData.clientAddress}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        className="h-12 pl-10"
                        placeholder="Start typing an address..."
                        autoComplete="off"
                      />
                    </div>
                    {showAddressSuggestions && addressSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                        {addressSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => selectAddress(suggestion)}
                            className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0 flex items-start gap-2"
                          >
                            <MapPin className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                            <span className="text-sm text-foreground">{suggestion.display_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Start typing to search for addresses
                    </p>
                  </div>
                </div>

                <div className="space-y-4 border border-dashed border-border rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        Beneficiaries {beneficiariesRequired && <span className="text-destructive">*</span>}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {beneficiariesRequired
                          ? "Add at least one beneficiary with name and relationship."
                          : "Add one or more beneficiaries for this policy. Leave blank if not applicable."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addBeneficiary}
                      className="inline-flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Beneficiary
                    </Button>
                  </div>

                  {beneficiaries.length === 0 && (
                    <div className="text-sm text-muted-foreground border border-border rounded-lg p-4 bg-card/40">
                      No beneficiaries added yet.
                    </div>
                  )}

                  <div className="space-y-4">
                    {beneficiaries.map((beneficiary, index) => (
                      <div key={beneficiary.id} className="border border-border rounded-lg p-4 bg-card/50 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">
                            Beneficiary {index + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBeneficiary(beneficiary.id)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm text-foreground font-medium">Full Name</label>
                            <Input
                              type="text"
                              value={beneficiary.name}
                              onChange={(e) => handleBeneficiaryChange(beneficiary.id, "name", e.target.value)}
                              placeholder="Jane Doe"
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm text-foreground font-medium">Relationship</label>
                            <Input
                              type="text"
                              value={beneficiary.relationship}
                              onChange={(e) => handleBeneficiaryChange(beneficiary.id, "relationship", e.target.value)}
                              placeholder="Spouse, Child, etc."
                              className="h-10"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="border-b border-border pb-4">
                  <h2 className="text-2xl font-bold text-foreground">Review & Submit</h2>
                  <p className="text-sm text-muted-foreground mt-1">Please review all information before submitting</p>
                </div>

                {/* Policy Information Review */}
                <div className="bg-accent/50 rounded-lg p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Policy Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Carrier:</span>
                      <p className="font-medium text-foreground mt-1">{getCarrierName(formData.carrierId)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Product:</span>
                      <p className="font-medium text-foreground mt-1">{getProductName(formData.productId)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Effective Date:</span>
                      <p className="font-medium text-foreground mt-1">{formData.policyEffectiveDate}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted Date:</span>
                      <p className="font-medium text-foreground mt-1">{formData.submittedDate || 'Today'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">SSN Benefit:</span>
                      <p className="font-medium text-foreground mt-1">{formData.ssnBenefit === "yes" ? "Yes" : "No"}</p>
                    </div>
                    {formData.ssnBenefit === "yes" && (
                      <div>
                        <span className="text-muted-foreground">Billing Date Pattern:</span>
                        <p className="font-medium text-foreground mt-1">{formData.billingDayOfMonth} {formData.billingWeekday}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Monthly Premium:</span>
                      <p className="font-medium text-foreground mt-1">${formData.monthlyPremium}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rate Class:</span>
                      <p className="font-medium text-foreground mt-1">{formData.rateClass || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Coverage Amount:</span>
                      <p className="font-medium text-foreground mt-1">
                        {formData.coverageAmount ? `$${parseFloat(formData.coverageAmount).toLocaleString()}` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Policy Number:</span>
                      <p className="font-medium text-foreground mt-1">{formData.policyNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Application Number:</span>
                      <p className="font-medium text-foreground mt-1">{formData.applicationNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Billing Cycle:</span>
                      <p className="font-medium text-foreground mt-1">
                        {formData.billingCycle
                          ? billingCycleOptions.find(opt => opt.value === formData.billingCycle)?.label
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Lead Source:</span>
                      <p className="font-medium text-foreground mt-1">{formData.leadSource || 'N/A'}</p>
                    </div>
                    {teamsOptions.length > 0 && formData.team && (
                      <div>
                        <span className="text-muted-foreground">Team:</span>
                        <p className="font-medium text-foreground mt-1">
                          {teamsOptions.find((t: { value: string; label: string }) => t.value === formData.team)?.label || formData.team}
                        </p>
                      </div>
                    )}
                    {formData.notes && (
                      <div className="md:col-span-2">
                        <span className="text-muted-foreground">Notes:</span>
                        <p className="font-medium text-foreground mt-1 whitespace-pre-wrap">{formData.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Client Information Review */}
                <div className="bg-accent/50 rounded-lg p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Client Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-medium text-foreground mt-1">{`${formData.clientFirstName} ${formData.clientLastName}`.trim()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium text-foreground mt-1">{formData.clientEmail || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <p className="font-medium text-foreground mt-1">{formData.clientPhone || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date of Birth:</span>
                      <p className="font-medium text-foreground mt-1">{formData.clientDateOfBirth || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Address:</span>
                      <p className="font-medium text-foreground mt-1">{formData.clientAddress || 'N/A'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-muted-foreground">Beneficiaries:</span>
                      {activeBeneficiaries.length === 0 ? (
                        <p className="font-medium text-foreground mt-1">None listed</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {activeBeneficiaries.map((beneficiary, index) => (
                            <div
                              key={beneficiary.id}
                              className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-md border border-border bg-card/40 p-3"
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  {beneficiary.name || `Beneficiary ${index + 1}`}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {beneficiary.relationship || 'Relationship not set'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="h-12 px-6"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              {currentStep < STEPS.length ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="h-12 px-6 bg-foreground hover:bg-foreground/90 text-background"
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  onClick={() => {
                    submitIntentRef.current = true
                  }}
                  disabled={submitDealMutation.isPending}
                  className="h-12 px-6 bg-foreground hover:bg-foreground/90 text-background disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitDealMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Submit Deal
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  )
}
