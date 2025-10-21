'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, User, Upload, Users, ClipboardCheck, ArrowRight, ArrowLeft, Loader2, X, FileText, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"

interface UserData {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  role: 'admin' | 'agent' | 'client'
  position_id?: string
  position_name?: string
  total_prod?: number
  total_policies_sold?: number
  perm_level: string
  annual_goal?: number
  is_admin: boolean
  status: 'pending' | 'active' | 'inactive'
  upline_id?: string | null
  upline_name?: string
  agency_id?: string
}

interface CarrierUpload {
  carrier: string
  file: File | null
}

interface InvitedAgent {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  permissionLevel: string
  uplineAgentId: string | null
}

interface AgentSearchResult {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface SearchOption {
  value: string
  label: string
}

const carriers = [
  'Aetna',
  'Aflac',
  'American Amicable',
  'Combined Insurance',
  'American Home Life',
  'Royal Neighbors'
]

const permissionLevels = [
  { value: "agent", label: "Agent" },
  { value: "admin", label: "Admin" }
]

// Step definitions will vary by role
const ADMIN_STEPS = [
  { id: 1, name: 'Account Info', icon: User },
  { id: 2, name: 'Policy Reports', icon: Upload },
  { id: 3, name: 'Add Team', icon: Users },
  { id: 4, name: 'Complete', icon: ClipboardCheck }
]

const AGENT_STEPS = [
  { id: 1, name: 'Account Info', icon: User },
  { id: 2, name: 'Add Team', icon: Users },
  { id: 3, name: 'Complete', icon: ClipboardCheck }
]

const CLIENT_STEPS = [
  { id: 1, name: 'Account Info', icon: User },
  { id: 2, name: 'Complete', icon: ClipboardCheck }
]

export default function SetupAccount() {
  const supabase = createClient()
  const router = useRouter()

  const [userData, setUserData] = useState<UserData | null>(null)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    password: "",
    confirmPassword: ""
  })

  // Policy reports upload state
  const [uploads, setUploads] = useState<CarrierUpload[]>(
    carriers.map(carrier => ({ carrier, file: null }))
  )
  const [uploadedFilesInfo, setUploadedFilesInfo] = useState<any[]>([])
  const [checkingExistingFiles, setCheckingExistingFiles] = useState(false)

  // Downline invitation state
  const [invitedAgents, setInvitedAgents] = useState<InvitedAgent[]>([])
  const [currentAgentForm, setCurrentAgentForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    permissionLevel: "",
    uplineAgentId: ""
  })
  const [showAgentForm, setShowAgentForm] = useState(false)
  const [agentSearchTerm, setAgentSearchTerm] = useState("")
  const [agentSearchResults, setAgentSearchResults] = useState<SearchOption[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const [errors, setErrors] = useState<string[]>([])
  const [errorFields, setErrorFields] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const errorRef = useRef<HTMLDivElement>(null)

  const STEPS = userData?.role === 'client'
    ? CLIENT_STEPS
    : userData?.is_admin
      ? ADMIN_STEPS
      : AGENT_STEPS

  useEffect(() => {
    fetchUserData()
  }, [])

  useEffect(() => {
    if (errors.length > 0 && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [errors])

  // Agent search debounce
  useEffect(() => {
    if (agentSearchTerm.length < 2) {
      setAgentSearchResults([])
      return
    }

    const debounceTimer = setTimeout(async () => {
      try {
        setIsSearching(true)
        const response = await fetch(`/api/search-agents?q=${encodeURIComponent(agentSearchTerm)}&limit=10`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        })

        if (response.ok) {
          const agents: AgentSearchResult[] = await response.json()
          if (Array.isArray(agents)) {
            const options: SearchOption[] = agents.map(agent => ({
              value: agent.id,
              label: `${agent.first_name} ${agent.last_name} - ${agent.email}`
            }))
            setAgentSearchResults(options)
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

  // Check for existing uploaded files when user is admin
  useEffect(() => {
    if (userData?.is_admin && currentStep === 2) {
      checkExistingFiles()
    }
  }, [userData, currentStep])

  const checkExistingFiles = async () => {
    if (!userData?.agency_id) return

    try {
      setCheckingExistingFiles(true)
      const response = await fetch('/api/upload-policy-reports/bucket', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.files && data.files.length > 0) {
          setUploadedFilesInfo(data.files)
        }
      }
    } catch (error) {
      console.error('Error checking existing files:', error)
    } finally {
      setCheckingExistingFiles(false)
    }
  }

  const fetchUserData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      console.log('User authenticated:', user.id)

      // Try to find user in users table with status='pending'
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', user.id)
        .eq('status', 'pending')
        .single()

      if (error) {
        console.error('Error fetching user data:', error)
        setErrors(['Failed to load user data. Your invitation may have expired or account is already set up.'])
        setLoading(false)
        return
      }

      setUserData(data)
      console.log('User data loaded:', data.role, 'is_admin:', data.is_admin)
      setFormData({
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        phoneNumber: data.phone_number || "",
        password: "",
        confirmPassword: ""
      })
    } catch (error) {
      console.error('Error:', error)
      setErrors(['Failed to load user data'])
    } finally {
      setLoading(false)
    }
  }

  const validateStepOne = () => {
    const newErrors: string[] = []
    const newErrorFields: Record<string, string> = {}

    // Phone validation (10 digits) - required for all users
    if (!formData.phoneNumber || formData.phoneNumber.length !== 10) {
      newErrors.push("Phone number must be 10 digits")
      newErrorFields.phoneNumber = formData.phoneNumber ? "Invalid phone format" : "Phone number is required"
    }

    // Password validation
    if (formData.password.length < 6) {
      newErrors.push("Password must be at least 6 characters")
      newErrorFields.password = "Password too short"
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.push("Passwords do not match")
      newErrorFields.confirmPassword = "Passwords do not match"
    }

    setErrors(newErrors)
    setErrorFields(newErrorFields)
    return newErrors.length === 0
  }

  const validateAgentForm = () => {
    const newErrors: string[] = []

    if (!currentAgentForm.firstName.trim()) {
      newErrors.push("First name is required")
    }
    if (!currentAgentForm.lastName.trim()) {
      newErrors.push("Last name is required")
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(currentAgentForm.email)) {
      newErrors.push("Invalid email format")
    }
    if (currentAgentForm.phoneNumber.length !== 10) {
      newErrors.push("Phone number must be 10 digits")
    }
    if (!currentAgentForm.permissionLevel) {
      newErrors.push("Permission level is required")
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }

  const handleFileUpload = (carrierIndex: number, file: File) => {
    const newUploads = [...uploads]
    newUploads[carrierIndex] = {
      ...newUploads[carrierIndex],
      file: file
    }
    setUploads(newUploads)
  }

  const handleFileRemove = (carrierIndex: number) => {
    const newUploads = [...uploads]
    newUploads[carrierIndex] = {
      ...newUploads[carrierIndex],
      file: null
    }
    setUploads(newUploads)
  }

  const handleAddAgent = () => {
    if (!validateAgentForm()) {
      return
    }

    const newAgent: InvitedAgent = {
      firstName: currentAgentForm.firstName,
      lastName: currentAgentForm.lastName,
      email: currentAgentForm.email,
      phoneNumber: currentAgentForm.phoneNumber,
      permissionLevel: currentAgentForm.permissionLevel,
      uplineAgentId: currentAgentForm.uplineAgentId || null
    }

    setInvitedAgents([...invitedAgents, newAgent])

    // Reset form
    setCurrentAgentForm({
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      permissionLevel: "",
      uplineAgentId: ""
    })
    setAgentSearchTerm("")
    setShowAgentForm(false)
    setErrors([])
  }

  const handleRemoveAgent = (index: number) => {
    setInvitedAgents(invitedAgents.filter((_, i) => i !== index))
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    if (errorFields[field]) {
      setErrorFields({ ...errorFields, [field]: '' })
    }
  }

  const nextStep = () => {
    setErrors([])

    // Validate current step before proceeding
    if (currentStep === 1 && !validateStepOne()) {
      return
    }

    setCurrentStep(prev => Math.min(prev + 1, STEPS.length))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const prevStep = () => {
    setErrors([])
    setCurrentStep(prev => Math.max(prev - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const skipStep = () => {
    setErrors([])
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updatePassword = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.password
      })

      if (error) {
        throw error
      }

      return true
    } catch (error) {
      console.error('Error updating password:', error)
      return false
    }
  }

  const uploadPolicyReports = async () => {
    const uploadedFiles = uploads.filter(upload => upload.file !== null)

    if (uploadedFiles.length === 0) {
      return { success: true, message: 'No files to upload' }
    }

    try {
      const formData = new FormData()

      uploadedFiles.forEach((upload) => {
        if (upload.file) {
          formData.append(`carrier_${upload.carrier}`, upload.file)
        }
      })

      const [bucketResponse, stagingResponse] = await Promise.all([
        fetch('/api/upload-policy-reports/bucket', {
          method: 'POST',
          body: formData,
        }),
        fetch('/api/upload-policy-reports/staging', {
          method: 'POST',
          body: formData,
        })
      ])

      const bucketResult = await bucketResponse.json()
      const stagingResult = await stagingResponse.json()

      if (bucketResult.success && stagingResult.success) {
        return {
          success: true,
          message: `Successfully uploaded ${stagingResult.totalRecordsInserted} policy records!`
        }
      } else {
        return {
          success: false,
          message: bucketResult.errors?.join(', ') || stagingResult.errors?.join(', ') || 'Upload failed'
        }
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      return { success: false, message: 'An error occurred while uploading files' }
    }
  }

  const inviteAgents = async (currentUserId: string) => {
    if (invitedAgents.length === 0) {
      return { success: true, message: 'No agents to invite' }
    }

    const results = []
    const errors = []

    for (const agent of invitedAgents) {
      try {
        const response = await fetch('/api/agents/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: agent.email,
            firstName: agent.firstName,
            lastName: agent.lastName,
            phoneNumber: agent.phoneNumber,
            permissionLevel: agent.permissionLevel,
            uplineAgentId: agent.uplineAgentId || currentUserId // Use current user as upline if none specified
          }),
          credentials: 'include'
        })

        const data = await response.json()

        if (response.ok) {
          results.push(`✓ ${agent.firstName} ${agent.lastName}`)
        } else {
          errors.push(`✗ ${agent.firstName} ${agent.lastName}: ${data.error}`)
        }
      } catch (error) {
        errors.push(`✗ ${agent.firstName} ${agent.lastName}: Network error`)
      }
    }

    return {
      success: errors.length === 0,
      message: errors.length === 0
        ? `Successfully invited ${results.length} agent(s)!`
        : `Invited ${results.length} agent(s), ${errors.length} failed: ${errors.join(', ')}`
    }
  }

  const handleFinalSubmit = async () => {
    setSubmitting(true)
    setErrors([])

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        setErrors(['Authentication error. Please try logging in again.'])
        return
      }

      // Update user record to change status from 'pending' to 'active'
      const userUpdateData: any = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phoneNumber || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(userUpdateData)
        .eq('id', userData?.id)
        .select()
        .single()

      if (updateError || !updatedUser) {
        console.error('Error updating user data:', updateError)
        setErrors(['Failed to activate user account. Please try again.'])
        return
      }

      // Update password
      const passwordUpdated = await updatePassword()
      if (!passwordUpdated) {
        setErrors(['Failed to update password. Please try again.'])
        return
      }

      // Upload policy reports if admin
      if (userData?.is_admin) {
        const uploadResult = await uploadPolicyReports()
        if (!uploadResult.success) {
          console.error('Policy upload warning:', uploadResult.message)
          // Continue anyway, just log the warning
        }
      }

      // Invite agents
      const inviteResult = await inviteAgents(updatedUser.id)
      if (!inviteResult.success) {
        console.error('Agent invitation warning:', inviteResult.message)
        // Continue anyway, just log the warning
      }

      // Clear sensitive data
      setFormData({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        password: "",
        confirmPassword: ""
      })

      // Success! Redirect based on role
      alert('Account setup complete! Welcome to the platform.')

      if (userData?.role === 'client') {
        router.push('/client/dashboard')
      } else {
        router.push('/')
      }
    } catch (error) {
      console.error('Error during final submission:', error)
      setErrors(['Failed to complete setup. Please try again.'])
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Failed to load user data</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gradient mb-2">
            {userData.role === 'client' ? 'Welcome!' : 'Setup Your Account'}
          </h1>
          <p className="text-muted-foreground">
            {userData.role === 'client'
              ? 'Set up your password to access your policy information'
              : `Complete your account setup in ${STEPS.length} easy steps`
            }
          </p>
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
        {errors.length > 0 && (
          <div
            ref={errorRef}
            className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/30"
          >
            {errors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </div>
        )}

        {/* Content Card */}
        <div className="bg-card rounded-xl shadow-lg border border-border p-8">
          {/* Step 1: Account Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-2xl font-bold text-foreground">Account Information</h2>
                <p className="text-sm text-muted-foreground mt-1">Confirm your information and set up your password</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    First name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    className="h-12"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Last name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    className="h-12"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  value={userData.email}
                  className="h-12 bg-gray-100 text-gray-500 cursor-not-allowed"
                  readOnly
                />
                <p className="text-xs text-muted-foreground">Contact admin to change email</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">
                  Phone number <span className="text-destructive">*</span>
                </label>
                <Input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                  className={`h-12 ${errorFields.phoneNumber ? 'border-red-500' : ''}`}
                  placeholder="1234567890"
                  required
                />
                {errorFields.phoneNumber && (
                  <p className="text-red-500 text-sm">{errorFields.phoneNumber}</p>
                )}
              </div>

              {(userData.role === 'agent' || userData.role === 'admin') && (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Permission Level
                    </label>
                    <Input
                      type="text"
                      value={userData.perm_level.charAt(0).toUpperCase() + userData.perm_level.slice(1).toLowerCase()}
                      className="h-12 bg-gray-100 text-gray-500 cursor-not-allowed"
                      readOnly
                    />
                  </div>

                  {userData.upline_name && (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-foreground">
                        Upline Agent
                      </label>
                      <Input
                        type="text"
                        value={userData.upline_name}
                        className="h-12 bg-gray-100 text-gray-500 cursor-not-allowed"
                        readOnly
                      />
                    </div>
                  )}
                </>
              )}

              <div className="pt-6 border-t border-border">
                <h3 className="text-lg font-semibold text-foreground mb-4">Set Up Password</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Password <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      className={`h-12 ${errorFields.password ? 'border-red-500' : ''}`}
                      placeholder="Enter your password"
                      required
                    />
                    {errorFields.password && (
                      <p className="text-red-500 text-sm">{errorFields.password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Confirm Password <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      className={`h-12 ${errorFields.confirmPassword ? 'border-red-500' : ''}`}
                      placeholder="Confirm your password"
                      required
                    />
                    {errorFields.confirmPassword && (
                      <p className="text-red-500 text-sm">{errorFields.confirmPassword}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 for Admin: Upload Policy Reports */}
          {currentStep === 2 && userData.is_admin && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-2xl font-bold text-foreground">Upload Policy Reports</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload CSV or Excel files for each carrier to track persistency rates
                </p>
              </div>

              {checkingExistingFiles && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Checking for existing uploads...</span>
                </div>
              )}

              {uploadedFilesInfo.length > 0 && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-blue-800">
                    <strong>Note:</strong> Previous uploads detected. New uploads will replace existing files for those carriers.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {uploads.map((upload, index) => (
                  <div key={upload.carrier} className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700 text-center">
                      {upload.carrier}
                    </h3>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 min-h-[200px] flex flex-col items-center justify-center">
                      {upload.file ? (
                        <div className="text-center">
                          <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            {upload.file.name}
                          </p>
                          <p className="text-xs text-gray-500 mb-4">
                            {(upload.file.size / 1024).toFixed(2)} KB
                          </p>
                          <Button
                            onClick={() => handleFileRemove(index)}
                            variant="outline"
                            size="sm"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            Click to upload
                          </p>
                          <p className="text-xs text-gray-500 mb-4">
                            CSV or Excel file
                          </p>
                          <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFileUpload(index, file)
                            }}
                            className="hidden"
                            id={`upload-${index}`}
                          />
                          <label
                            htmlFor={`upload-${index}`}
                            className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded text-sm text-gray-700 inline-block"
                          >
                            Choose File
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Alert className="bg-amber-50 border-amber-200">
                <AlertDescription className="text-amber-800">
                  <strong>Optional:</strong> You can skip this step and upload reports later in the Configuration page if you don't have them ready now.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 2 for Agent OR Step 3 for Admin: Add Team Members (Not for clients) */}
          {((currentStep === 2 && !userData.is_admin && userData.role !== 'client') || (currentStep === 3 && userData.is_admin)) && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-2xl font-bold text-foreground">Add Team Members</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Invite agents to join your team (optional)
                </p>
              </div>

              {/* List of invited agents */}
              {invitedAgents.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Pending Invitations ({invitedAgents.length})</h3>
                  {invitedAgents.map((agent, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-accent/30 rounded-lg border border-border">
                      <div>
                        <p className="font-medium text-foreground">
                          {agent.firstName} {agent.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">{agent.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {permissionLevels.find(p => p.value === agent.permissionLevel)?.label || agent.permissionLevel}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAgent(index)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add agent form */}
              {!showAgentForm ? (
                <Button
                  onClick={() => setShowAgentForm(true)}
                  variant="outline"
                  className="w-full h-12"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team Member
                </Button>
              ) : (
                <div className="border border-border rounded-lg p-6 space-y-4 bg-accent/10">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-lg font-semibold text-foreground">New Team Member</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAgentForm(false)
                        setCurrentAgentForm({
                          firstName: "",
                          lastName: "",
                          email: "",
                          phoneNumber: "",
                          permissionLevel: "",
                          uplineAgentId: ""
                        })
                        setErrors([])
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-foreground">
                        First Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="text"
                        value={currentAgentForm.firstName}
                        onChange={(e) => setCurrentAgentForm({ ...currentAgentForm, firstName: e.target.value })}
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-foreground">
                        Last Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="text"
                        value={currentAgentForm.lastName}
                        onChange={(e) => setCurrentAgentForm({ ...currentAgentForm, lastName: e.target.value })}
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Email <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      value={currentAgentForm.email}
                      onChange={(e) => setCurrentAgentForm({ ...currentAgentForm, email: e.target.value })}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Phone Number <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="tel"
                      value={currentAgentForm.phoneNumber}
                      onChange={(e) => setCurrentAgentForm({ ...currentAgentForm, phoneNumber: e.target.value })}
                      className="h-10"
                      placeholder="1234567890"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Permission Level <span className="text-destructive">*</span>
                    </label>
                    <SimpleSearchableSelect
                      options={userData.is_admin ? permissionLevels : permissionLevels.filter(p => p.value === 'agent')}
                      value={currentAgentForm.permissionLevel}
                      onValueChange={(value) => setCurrentAgentForm({ ...currentAgentForm, permissionLevel: value })}
                      placeholder="Select permission level"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Upline Agent (Optional)
                    </label>
                    <Input
                      type="text"
                      value={agentSearchTerm}
                      onChange={(e) => setAgentSearchTerm(e.target.value)}
                      className="h-10"
                      placeholder="Type to search for upline agent..."
                    />

                    {isSearching && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Searching...
                      </div>
                    )}

                    {agentSearchResults.length > 0 && (
                      <div className="border border-border rounded-lg bg-card shadow-lg max-h-40 overflow-y-auto">
                        {agentSearchResults.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-accent/50 border-b border-border last:border-b-0 text-sm"
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

                    {currentAgentForm.uplineAgentId && (
                      <div className="p-2 bg-accent/30 rounded border border-border text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-foreground">
                            Selected: {agentSearchResults.find(r => r.value === currentAgentForm.uplineAgentId)?.label || 'Agent selected'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentAgentForm({ ...currentAgentForm, uplineAgentId: "" })
                              setAgentSearchTerm("")
                            }}
                            className="text-destructive hover:text-destructive/80 text-xs"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleAddAgent}
                    className="w-full btn-gradient"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add to List
                  </Button>
                </div>
              )}

              <Alert className="bg-amber-50 border-amber-200">
                <AlertDescription className="text-amber-800">
                  <strong>Optional:</strong> You can skip this step and invite team members later from the Agents page.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Final Step: Review & Complete */}
          {currentStep === STEPS.length && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <h2 className="text-2xl font-bold text-foreground">Review & Complete</h2>
                <p className="text-sm text-muted-foreground mt-1">Please review your information before completing setup</p>
              </div>

              {/* Account Info Review */}
              <div className="bg-accent/50 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Account Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <p className="font-medium text-foreground mt-1">{formData.firstName} {formData.lastName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium text-foreground mt-1">{userData.email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <p className="font-medium text-foreground mt-1">{formData.phoneNumber || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Role:</span>
                    <p className="font-medium text-foreground mt-1">
                      {userData.perm_level.charAt(0).toUpperCase() + userData.perm_level.slice(1).toLowerCase()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Policy Reports Review (Admin only) */}
              {userData.is_admin && (
                <div className="bg-accent/50 rounded-lg p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    Policy Reports
                  </h3>
                  <div className="text-sm">
                    {uploads.filter(u => u.file !== null).length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-muted-foreground">
                          Files to upload: {uploads.filter(u => u.file !== null).length}
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {uploads.filter(u => u.file !== null).map((upload) => (
                            <li key={upload.carrier} className="text-foreground">
                              {upload.carrier}: {upload.file?.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No files selected (can be uploaded later)</p>
                    )}
                  </div>
                </div>
              )}

              {/* Team Members Review (Not for clients) */}
              {userData.role !== 'client' && (
                <div className="bg-accent/50 rounded-lg p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Team Members
                  </h3>
                  <div className="text-sm">
                    {invitedAgents.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-muted-foreground">
                          Invitations to send: {invitedAgents.length}
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {invitedAgents.map((agent, index) => (
                            <li key={index} className="text-foreground">
                              {agent.firstName} {agent.lastName} ({agent.email}) - {permissionLevels.find(p => p.value === agent.permissionLevel)?.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No team members added (can be invited later)</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-6 mt-8 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1 || submitting}
              className="h-12 px-6"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>

            <div className="flex gap-3">
              {/* Show skip button for policy reports and team member steps (not for clients) */}
              {userData.role !== 'client' && ((currentStep === 2 && userData.is_admin) ||
                (currentStep === 2 && !userData.is_admin && userData.role !== 'client') ||
                (currentStep === 3 && userData.is_admin)) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={skipStep}
                  disabled={submitting}
                  className="h-12 px-6"
                >
                  Skip for Now
                </Button>
              )}

              {currentStep < STEPS.length ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={submitting}
                  className="h-12 px-6 btn-gradient"
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                  className="h-12 px-6 btn-gradient disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Completing Setup...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete Setup
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
