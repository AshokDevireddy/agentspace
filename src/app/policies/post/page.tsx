"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { useAuth } from "@/providers/AuthProvider"
import { createClient } from "@/lib/supabase/client"
import { Loader2, CheckCircle2, Circle, ArrowRight, ArrowLeft, FileText, User, ClipboardCheck, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNotification } from "@/contexts/notification-context"

// Options are loaded dynamically from Supabase based on the user's agency

const initialFormData = {
  carrierId: "",
  productId: "",
  policyEffectiveDate: "",
  monthlyPremium: "",
  billingCycle: "",
  leadSource: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  clientDateOfBirth: "",
  clientAddress: "",
  policyNumber: "",
  applicationNumber: "",
};

type Beneficiary = {
  id: string;
  name: string;
  relationship: string;
};

type FormField = keyof typeof initialFormData;

const requiredFields: FormField[] = [
  "carrierId", "productId", "policyEffectiveDate", "monthlyPremium",
  "billingCycle", "leadSource",
  "clientName", "clientEmail", "clientPhone", "clientDateOfBirth",
  "clientAddress", "policyNumber"
];

const STEPS = [
  { id: 1, name: 'Policy Information', icon: FileText },
  { id: 2, name: 'Client Information', icon: User },
  { id: 3, name: 'Review & Submit', icon: ClipboardCheck }
]

export default function PostDeal() {
  const [formData, setFormData] = useState<typeof initialFormData>(initialFormData)
  const { user } = useAuth()
  const supabase = createClient()
  const router = useRouter()
  const { showSuccess, showError, showWarning } = useNotification()

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const submitIntentRef = useRef(false)

  // Dynamic option states
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [carriersOptions, setCarriersOptions] = useState<{ value: string, label: string }[]>([])
  const [productsOptions, setProductsOptions] = useState<{ value: string, label: string }[]>([])
  const [leadSourceOptions, setLeadSourceOptions] = useState<{ value: string, label: string }[]>([])
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])

  // Position check states
  const [positionCheckLoading, setPositionCheckLoading] = useState(true)
  const [hasAllPositions, setHasAllPositions] = useState(false)
  const [missingPositions, setMissingPositions] = useState<any[]>([])
  const [isAdminUser, setIsAdminUser] = useState(false)

  // Billing cycle options (fixed enum)
  const billingCycleOptions = [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "semi-annually", label: "Semi-Annually" },
    { value: "annually", label: "Annually" },
  ]

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [error])

  // Check if user and upline have positions assigned
  useEffect(() => {
    const checkPositions = async () => {
      if (!user?.id) return

      try {
        setPositionCheckLoading(true)

        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (!accessToken) {
          setPositionCheckLoading(false)
          return
        }

        const response = await fetch('/api/agents/check-positions', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          setHasAllPositions(data.has_all_positions)
          setMissingPositions(data.missing_positions || [])
        } else {
          console.error('Failed to check positions')
          // Default to blocking if check fails
          setHasAllPositions(false)
        }
      } catch (err) {
        console.error('Error checking positions:', err)
        // Default to blocking if check fails
        setHasAllPositions(false)
      } finally {
        setPositionCheckLoading(false)
      }
    }

    checkPositions()
  }, [user?.id])

  // Load user's agency and initial options
  useEffect(() => {
    const loadAgencyAndOptions = async () => {
      if (!user?.id) return
      // Fetch the current user's agency_id
      const { data: currentUser, error: currentUserError } = await supabase
        .from('users')
        .select('id, agency_id, is_admin, role')
        .eq('auth_user_id', user.id)
        .single()

      if (currentUserError || !currentUser?.agency_id) {
        return
      }

      const agencyIdVal = currentUser.agency_id as string
      setAgencyId(agencyIdVal)
      setIsAdminUser(Boolean(currentUser.is_admin || currentUser.role === 'admin'))

      // Load agency's lead sources
      const { data: agencyData } = await supabase
        .from('agencies')
        .select('lead_sources')
        .eq('id', agencyIdVal)
        .single()

      if (agencyData?.lead_sources) {
        setLeadSourceOptions(
          agencyData.lead_sources.map((source: string) => ({
            value: source,
            label: source
          }))
        )
      }

      // Load carriers that have products for this agency
      const { data: productsForAgency } = await supabase
        .from('products')
        .select('carrier_id, carriers(id, display_name, is_active)')
        .eq('agency_id', agencyIdVal)
        .eq('is_active', true)

      const carrierMap = new Map<string, { id: string, display_name: string }>()
      ;(productsForAgency || []).forEach((p: any) => {
        const c = p.carriers
        if (c && c.is_active !== false && !carrierMap.has(c.id)) {
          carrierMap.set(c.id, { id: c.id, display_name: c.display_name })
        }
      })
      setCarriersOptions(Array.from(carrierMap.values()).map(c => ({ value: c.id, label: c.display_name })))
    }

    loadAgencyAndOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Load products when carrier changes
  useEffect(() => {
    const loadProducts = async () => {
      if (!agencyId || !formData.carrierId) {
        setProductsOptions([])
        return
      }
      const { data: products } = await supabase
        .from('products')
        .select('id, name, is_active')
        .eq('agency_id', agencyId)
        .eq('carrier_id', formData.carrierId)
        .eq('is_active', true)
        .order('name')

      setProductsOptions((products || []).map((p: any) => ({ value: p.id, label: p.name })))
    }
    loadProducts()
  }, [agencyId, formData.carrierId])

  const sendDiscordNotification = async (
    agencyId: string,
    agentId: string,
    formData: typeof initialFormData,
    monthlyPremium: number
  ) => {
    try {
      // Get agent name
      const { data: agentData } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', agentId)
        .single()

      const agentName = agentData
        ? `${agentData.first_name} ${agentData.last_name}`
        : 'Unknown Agent'

      // Get carrier and product names
      const carrierName = getCarrierName(formData.carrierId)
      const productName = getProductName(formData.productId)

      // Build the Discord message
      const message = `**Agent:** ${agentName}
      **Carrier:** ${carrierName}
      **Product:** ${productName}
      **Annual Premium:** $${(monthlyPremium * 12).toFixed(2)}`

      // Send to Discord webhook API
      await fetch('/api/discord/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agencyId,
          message,
        }),
      })
    } catch (error) {
      // Log error but don't throw - we don't want to fail the deal submission
      console.error('Error sending Discord notification:', error)
    }
  }

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

    setSubmitting(true)
    setError(null)

    try {
      // SECTION 1: Get current user's agent_id from auth context
      if (!user?.id) {
        setError("User not authenticated. Please log in again.")
        setSubmitting(false)
        return
      }

      // Ensure agency_id is loaded
      if (!agencyId) {
        setError("Agency information not loaded. Please refresh the page and try again.")
        setSubmitting(false)
        return
      }

      // Get the user's agent_id from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (userError || !userData) {
        setError("Failed to get user information. Please try again.")
        setSubmitting(false)
        return
      }

      const agent_id = userData.id

      // SECTION 2: Use selected IDs directly
      const carrier_id = formData.carrierId
      const product_id = formData.productId

      // SECTION 3: Invite client if email is provided
      let client_id = null
      let invitationMessage = ''

      if (formData.clientEmail) {
        try {
          // Check if client already exists in users table (including pending)
          const { data: existingClient } = await supabase
            .from('users')
            .select('id, auth_user_id, status')
            .eq('email', formData.clientEmail)
            .eq('role', 'client')
            .maybeSingle()

          if (existingClient) {
            client_id = existingClient.id
            invitationMessage = existingClient.status === 'pending'
              ? 'Client invitation was previously sent.'
              : 'Client already has an account.'
            console.log('Client exists:', client_id, 'status:', existingClient.status)
          } else {
              // Send invitation to client
              console.log('Sending invitation to:', formData.clientEmail)
              const inviteResponse = await fetch('/api/clients/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: formData.clientEmail,
                  // Extract first and last name from client name if possible
                  firstName: formData.clientName.split(' ')[0] || formData.clientName,
                  lastName: formData.clientName.split(' ').slice(1).join(' ') || 'Client',
                  phoneNumber: formData.clientPhone
                })
              })

            const inviteData = await inviteResponse.json()
            console.log('Invite API response:', inviteData)

            if (inviteResponse.ok && inviteData.success) {
              client_id = inviteData.userId
              invitationMessage = inviteData.alreadyExists
                ? 'Client invitation was previously sent.'
                : '✓ Invitation email sent to client successfully!'
              console.log('Client invitation sent successfully, client_id:', client_id)
            } else {
              const errorMsg = inviteData.error || 'Unknown error'
              console.error('Failed to invite client:', errorMsg)
              invitationMessage = `⚠️ Warning: Failed to send invitation email (${errorMsg}). Deal will still be created.`
              // Continue anyway, but warn the user
            }
          }
        } catch (clientError) {
          console.error('Error inviting client:', clientError)
          invitationMessage = `⚠️ Warning: Error sending invitation (${clientError instanceof Error ? clientError.message : 'Unknown error'}). Deal will still be created.`
          // Continue anyway, but warn the user
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
            allocation_percentage: null,
          }
        })

      // SECTION 4: Construct payload and submit to API
      const monthlyPremium = parseFloat(formData.monthlyPremium)
      const payload = {
        agent_id,
        carrier_id,
        product_id,
        client_id,
        agency_id: agencyId,
        client_name: formData.clientName,
        client_email: formData.clientEmail || null,
        client_phone: formData.clientPhone || null,
        date_of_birth: formData.clientDateOfBirth || null,
        ssn_last_4: null,
        client_address: formData.clientAddress || null,
        policy_number: formData.policyNumber,
        application_number: formData.applicationNumber || null,
        monthly_premium: monthlyPremium,
        annual_premium: monthlyPremium * 12,
        policy_effective_date: formData.policyEffectiveDate,
        billing_cycle: formData.billingCycle || null,
        lead_source: formData.leadSource || null,
        beneficiaries: normalizedBeneficiaries,
      }

      console.log('[PostDeal] Submitting payload to /api/deals', payload)
      console.log('[PostDeal] Agency ID being sent:', agencyId)
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      console.log('[PostDeal] /api/deals response', { ok: res.ok, status: res.status, data })

      if (!res.ok) {
        setError(data.error || "Failed to submit deal.")
        setSubmitting(false)
        return
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

      console.log("Deal operation complete:", successMessage)

      // Send Discord notification (don't block on this - fire and forget)
      sendDiscordNotification(agencyId, agent_id, formData, monthlyPremium).catch(err => {
        console.error('Failed to send Discord notification:', err)
        // Don't fail the whole operation if Discord notification fails
      })

      showSuccess(successMessage, 7000)
      setBeneficiaries([])

      router.push("/policies/book")

    } catch (err) {
      setError("An unexpected error occurred.")
    } finally {
      setSubmitting(false)
      submitIntentRef.current = false
    }
  }

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter") {
      // Block Enter from submitting; require explicit click on Submit button
      e.preventDefault()
    }
  }

  const handleInputChange = (field: string, value: string) => {
    // For monthly premium, allow any string (including empty, partial numbers)
    if (field === "monthlyPremium") {
      // Don't allow negative sign as the first character
      if (value.startsWith("-")) return
      setFormData({ ...formData, [field]: value })
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
      if (!formData.monthlyPremium) {
        setError("Please enter the monthly premium.")
        return false
      }
      const monthly = parseFloat(formData.monthlyPremium)
      if (Number.isNaN(monthly) || monthly < 0) {
        setError("Please enter a valid monthly premium.")
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
    } else if (step === 2) {
      // Client Information validation
      if (!formData.clientName) {
        setError("Please enter the client's full name (first and last).")
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
      if (!formData.clientDateOfBirth) {
        setError("Please enter the client's date of birth.")
        return false
      }
      if (!formData.clientAddress) {
        setError("Please enter the client's address.")
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
    return carriersOptions.find(c => c.value === id)?.label || id
  }

  const getProductName = (id: string) => {
    return productsOptions.find(p => p.value === id)?.label || id
  }

  const activeBeneficiaries = beneficiaries.filter(b =>
    b.name.trim() || b.relationship.trim()
  )

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
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
                    <li key={agent.agent_id}>
                      {agent.first_name} {agent.last_name} ({agent.email})
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

      {/* Only show form if positions are valid */}
      {!positionCheckLoading && hasAllPositions && (
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
                      Full Name (First and Last) <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.clientName}
                      onChange={(e) => handleInputChange("clientName", e.target.value)}
                      className="h-12"
                      placeholder="Enter client's full name"
                    />
                  </div>

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
                      placeholder="Enter phone number"
                    />
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
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Address <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.clientAddress}
                      onChange={(e) => handleInputChange("clientAddress", e.target.value)}
                      className="h-12"
                      placeholder="Enter address"
                    />
                  </div>
                </div>

                <div className="space-y-4 border border-dashed border-border rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Beneficiaries (Optional)</h3>
                      <p className="text-sm text-muted-foreground">
                        Add one or more beneficiaries for this policy. Leave blank if not applicable.
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
                      <span className="text-muted-foreground">Monthly Premium:</span>
                      <p className="font-medium text-foreground mt-1">${formData.monthlyPremium}</p>
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
                      <p className="font-medium text-foreground mt-1">{formData.clientName}</p>
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
                  disabled={submitting}
                  className="h-12 px-6 bg-foreground hover:bg-foreground/90 text-background disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
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