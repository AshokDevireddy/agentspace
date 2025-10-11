"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { useAuth } from "@/providers/AuthProvider"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

// Options are loaded dynamically from Supabase based on the user's agency

const initialFormData = {
  carrierId: "",
  productId: "",
  policyEffectiveDate: "",
  annualPremium: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  policyNumber: "",
  applicationNumber: "",
  splitAgentId: "",
  splitPercentage: "0.0",
  referralCount: "",
  leadSource: "",
};

type FormField = keyof typeof initialFormData;

const requiredFields: FormField[] = [
  "carrierId", "productId", "policyEffectiveDate", "annualPremium",
  "clientName", "policyNumber", "leadSource"
];

export default function PostDeal() {
  const [formData, setFormData] = useState<typeof initialFormData>(initialFormData)
  const { user } = useAuth()
  const supabase = createClient()
  const router = useRouter()

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)

  // Dynamic option states
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [carriersOptions, setCarriersOptions] = useState<{ value: string, label: string }[]>([])
  const [productsOptions, setProductsOptions] = useState<{ value: string, label: string }[]>([])
  const [agentsOptions, setAgentsOptions] = useState<{ value: string, label: string }[]>([])

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

      // Load all agents in this agency
      const { data: agencyUsers } = await supabase
        .from('users')
        .select('id, first_name, last_name, is_active')
        .eq('agency_id', agencyIdVal)
        .eq('is_active', true)
        .order('last_name')

      setAgentsOptions((agencyUsers || []).map((u: any) => ({ value: u.id, label: `${u.last_name}, ${u.first_name}` })))
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
    if (!validateForm()) return

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

      // SECTION 3: Split agent (optional)
      const split_agent_id = formData.splitAgentId || null

      // SECTION 4: Invite client if email is provided
      let client_auth_id = null
      if (formData.clientEmail) {
        try {
          // Check if client already exists
          const { data: existingClient } = await supabase
            .from('users')
            .select('id, auth_user_id')
            .eq('email', formData.clientEmail)
            .eq('role', 'client')
            .maybeSingle()

          if (existingClient) {
            client_auth_id = existingClient.id
          } else {
            // Send invitation to client
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
            if (inviteResponse.ok) {
              client_auth_id = inviteData.userId
              console.log('Client invitation sent successfully')
            } else {
              console.warn('Failed to invite client:', inviteData.error)
              // Continue anyway, don't fail the deal creation
            }
          }
        } catch (clientError) {
          console.warn('Error inviting client:', clientError)
          // Continue anyway, don't fail the deal creation
        }
      }

      // SECTION 5: Construct payload and submit to API
      const payload = {
        agent_id,
        carrier_id,
        product_id,
        client_name: formData.clientName,
        client_email: formData.clientEmail || null,
        client_phone: formData.clientPhone,
        policy_number: formData.policyNumber,
        application_number: formData.applicationNumber,
        monthly_premium: parseFloat(formData.annualPremium) / 12,
        annual_premium: parseFloat(formData.annualPremium),
        policy_effective_date: formData.policyEffectiveDate,
        split_agent_id,
        split_percentage: formData.splitPercentage ? parseFloat(formData.splitPercentage) : null,
        referral_count: formData.referralCount ? parseInt(formData.referralCount) : 0,
        lead_source: formData.leadSource,
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
      if (data.operation === 'updated') {
        console.log("Deal updated successfully!")
        alert("Deal updated successfully! This policy already existed and has been updated with your additional information.")
      } else {
        console.log("Deal created successfully!")
        alert("Deal created successfully!")
      }

      router.push("/policies/book")

    } catch (err) {
      setError("An unexpected error occurred.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    // For annual premium, allow any string (including empty, partial numbers)
    if (field === "annualPremium") {
      // Don't allow negative sign as the first character
      if (value.startsWith("-")) return
      setFormData({ ...formData, [field]: value })
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
    // Premium check (annual premium must be a valid non-negative number)
    const annual = parseFloat(formData.annualPremium)
    if (Number.isNaN(annual) || annual < 0) {
      setError("Please enter a valid annual premium.")
      return false
    }
    setError(null)
    return true
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gradient mb-2">Post a Deal</h1>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          ref={errorRef}
          className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/30"
        >
          {error}
        </div>
      )}

      {/* Form */}
      <Card className="professional-card">
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Carrier */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">
                Carrier
              </label>
              <SimpleSearchableSelect
                options={carriersOptions}
                value={formData.carrierId}
                onValueChange={(value) => handleInputChange("carrierId", value)}
              />
            </div>

            {/* Product */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">
                Product
              </label>
              <SimpleSearchableSelect
                options={productsOptions}
                value={formData.productId}
                onValueChange={(value) => handleInputChange("productId", value)}
              />
            </div>

            {/* Policy Effective / Draft Date */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">
                Policy Effective / Draft Date
              </label>
              <Input
                type="date"
                value={formData.policyEffectiveDate}
                onChange={(e) => handleInputChange("policyEffectiveDate", e.target.value)}
                className="h-12"
              />
            </div>

            {/* Premium Field */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted-foreground">
                  What was the annual premium for the policy you wrote?
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.annualPremium}
                  onChange={(e) => handleInputChange("annualPremium", e.target.value)}
                  className="h-12"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Client Information */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted-foreground">
                    Client name
                  </label>
                  <Input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => handleInputChange("clientName", e.target.value)}
                    className="h-12"
                    placeholder="Enter client name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted-foreground">
                    Client email
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

              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted-foreground">
                  Client phone number
                </label>
                <Input
                  type="tel"
                  value={formData.clientPhone}
                  onChange={(e) => handleInputChange("clientPhone", e.target.value)}
                  className="h-12"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            {/* Policy Number */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">
                Policy number
              </label>
              <Input
                type="text"
                value={formData.policyNumber}
                onChange={(e) => handleInputChange("policyNumber", e.target.value)}
                className="h-12"
                placeholder="Enter policy number"
              />
              <p className="text-xs text-muted-foreground">
                If the carrier has not given you a policy number yet, leave this blank and fill out the application number field below
              </p>
            </div>

            {/* Application Number */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">
                Application number
              </label>
              <Input
                type="text"
                value={formData.applicationNumber}
                onChange={(e) => handleInputChange("applicationNumber", e.target.value)}
                className="h-12"
                placeholder="Enter application number"
              />
              <p className="text-xs text-muted-foreground">
                Enter an application number if the carrier has not given you a policy number yet
              </p>
            </div>

            {/* Split Commission */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted-foreground">
                  Split Commission with another Agent
                </label>
                <SimpleSearchableSelect
                  options={agentsOptions}
                  value={formData.splitAgentId}
                  onValueChange={(value) => handleInputChange("splitAgentId", value)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted-foreground">
                  Split percentage
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.splitPercentage}
                  onChange={(e) => handleInputChange("splitPercentage", e.target.value)}
                  className="h-12"
                />
              </div>
            </div>

            {/* Referrals */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">
                How many referrals did you collect from this client?
              </label>
              <Input
                type="number"
                min="0"
                value={formData.referralCount}
                onChange={(e) => handleInputChange("referralCount", e.target.value)}
                className="h-12"
                placeholder="0"
              />
            </div>

            {/* Lead Source */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-muted-foreground">
                Lead Source
              </label>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="leadSource"
                    value="referral"
                    checked={formData.leadSource === "referral"}
                    onChange={(e) => handleInputChange("leadSource", e.target.value)}
                    className="mr-3 text-primary"
                  />
                  <span className="text-sm text-foreground">Referral</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="leadSource"
                    value="purchased"
                    checked={formData.leadSource === "purchased"}
                    onChange={(e) => handleInputChange("leadSource", e.target.value)}
                    className="mr-3 text-primary"
                  />
                  <span className="text-sm text-foreground">Purchased Lead</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="leadSource"
                    value="provided"
                    checked={formData.leadSource === "provided"}
                    onChange={(e) => handleInputChange("leadSource", e.target.value)}
                    className="mr-3 text-primary"
                  />
                  <span className="text-sm text-foreground">Provided Lead</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="leadSource"
                    value="no-lead"
                    checked={formData.leadSource === "no-lead"}
                    onChange={(e) => handleInputChange("leadSource", e.target.value)}
                    className="mr-3 text-primary"
                  />
                  <span className="text-sm text-foreground">No Lead</span>
                </label>
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm" className="text-primary border-primary hover:bg-primary/10">
                  Submit referrals here
                </Button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 btn-gradient font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}