"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { useAuth } from "@/providers/AuthProvider"
import { createClient } from "@/lib/supabase/client"
import { Loader2, CheckCircle2, Circle, ArrowRight, ArrowLeft, FileText, User, ClipboardCheck } from "lucide-react"
import { cn } from "@/lib/utils"

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
  clientSsnLast4: "",
  clientAddress: "",
  policyNumber: "",
  applicationNumber: "",
};

type FormField = keyof typeof initialFormData;

const requiredFields: FormField[] = [
  "carrierId", "productId", "policyEffectiveDate", "monthlyPremium",
  "billingCycle", "leadSource",
  "clientName", "clientEmail", "clientPhone", "clientDateOfBirth",
  "clientSsnLast4", "clientAddress", "policyNumber"
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

  // Load user's agency and initial options
  useEffect(() => {
    const loadAgencyAndOptions = async () => {
      if (!user?.id) return
      // Fetch the current user's agency_id
      const { data: currentUser, error: currentUserError } = await supabase
        .from('users')
        .select('id, agency_id')
        .eq('auth_user_id', user.id)
        .single()

      if (currentUserError || !currentUser?.agency_id) {
        return
      }

      const agencyIdVal = currentUser.agency_id as string
      setAgencyId(agencyIdVal)

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

      // SECTION 4: Construct payload and submit to API
      const monthlyPremium = parseFloat(formData.monthlyPremium)
      const payload = {
        agent_id,
        carrier_id,
        product_id,
        client_id,
        client_name: formData.clientName,
        client_email: formData.clientEmail || null,
        client_phone: formData.clientPhone || null,
        date_of_birth: formData.clientDateOfBirth || null,
        ssn_last_4: formData.clientSsnLast4 || null,
        client_address: formData.clientAddress || null,
        policy_number: formData.policyNumber,
        application_number: formData.applicationNumber || null,
        monthly_premium: monthlyPremium,
        annual_premium: monthlyPremium * 12,
        policy_effective_date: formData.policyEffectiveDate,
        billing_cycle: formData.billingCycle || null,
        lead_source: formData.leadSource || null,
      }

      console.log('[PostDeal] Submitting payload to /api/deals', payload)
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
      alert(successMessage)

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
    // For SSN last 4, only allow 4 digits
    if (field === "clientSsnLast4") {
      const cleaned = value.replace(/\D/g, "")
      if (cleaned.length <= 4) {
        setFormData({ ...formData, [field]: cleaned })
      }
      return
    }
    setFormData({ ...formData, [field]: value })
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
      if (!formData.clientSsnLast4) {
        setError("Please enter the last 4 digits of the client's SSN.")
        return false
      }
      if (formData.clientSsnLast4.length !== 4) {
        setError("SSN last 4 digits must be exactly 4 digits.")
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

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gradient mb-2">Post a Deal</h1>
        <p className="text-muted-foreground">Submit a new policy in {STEPS.length} easy steps</p>
      </div>

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
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Last 4 Digits of SSN <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.clientSsnLast4}
                      onChange={(e) => handleInputChange("clientSsnLast4", e.target.value)}
                      className="h-12"
                      placeholder="1234"
                      maxLength={4}
                    />
                  </div>

                  <div className="space-y-2">
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
                      <span className="text-muted-foreground">SSN (Last 4):</span>
                      <p className="font-medium text-foreground mt-1">{formData.clientSsnLast4 || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Address:</span>
                      <p className="font-medium text-foreground mt-1">{formData.clientAddress || 'N/A'}</p>
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
                  className="h-12 px-6 btn-gradient"
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
                  className="h-12 px-6 btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  )
}