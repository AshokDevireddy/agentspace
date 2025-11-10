'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, Users, Loader2, X, FileText, Plus, CheckCircle2 } from "lucide-react"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { putToSignedUrl } from '@/lib/upload-policy-reports/client'

interface UserData {
  id: string
  first_name: string
  last_name: string
  email: string
  role: 'admin' | 'agent' | 'client'
  is_admin: boolean
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
  preInviteUserId?: string | null
}

interface AgentSearchResult {
  id: string
  first_name: string
  last_name: string
  email: string
  status?: string
}

interface SearchOption {
  value: string
  label: string
  status?: string
}

const carriers = [
  'Aetna',
  'Aflac',
  'American Amicable',
  'Combined Insurance',
  'American Home Life',
  'Royal Neighbors',
  'Liberty Bankers Life',
  'Foresters'
]

const permissionLevels = [
  { value: "agent", label: "Agent" },
  { value: "admin", label: "Admin" }
]

interface OnboardingWizardProps {
  userData: UserData
  onComplete: () => void
}

export default function OnboardingWizard({ userData, onComplete }: OnboardingWizardProps) {
  const supabase = createClient()
  const router = useRouter()

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

  // Pre-invite user search state
  const [nameSearchTerm, setNameSearchTerm] = useState("")
  const [nameSearchResults, setNameSearchResults] = useState<SearchOption[]>([])
  const [isNameSearching, setIsNameSearching] = useState(false)
  const [selectedPreInviteUserId, setSelectedPreInviteUserId] = useState<string | null>(null)

  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState(userData.is_admin ? 1 : 2) // Admins start at 1 (policy reports), agents start at 2 (team)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (errors.length > 0 && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [errors])

  // Agent search debounce (for upline selection)
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

  // Name search for pre-invite users
  useEffect(() => {
    if (nameSearchTerm.length < 2) {
      setNameSearchResults([])
      return
    }

    const debounceTimer = setTimeout(async () => {
      try {
        setIsNameSearching(true)
        console.log('[ONBOARDING] Starting name search for:', nameSearchTerm)

        const response = await fetch(`/api/search-agents?q=${encodeURIComponent(nameSearchTerm)}&limit=10`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        })

        console.log('[ONBOARDING] Response status:', response.status, response.statusText)

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage = errorData?.error || `Search failed`;
          console.error('[ONBOARDING] Name search error:', errorMessage, errorData?.detail)
          console.error('[ONBOARDING] Full error data:', errorData)
          setNameSearchResults([])
          return
        }

        const agents: AgentSearchResult[] = await response.json()
        console.log('[ONBOARDING] Received', agents?.length || 0, 'agents')

        if (!Array.isArray(agents)) {
          console.warn('[ONBOARDING] Search API returned non-array result:', agents);
          setNameSearchResults([]);
          return;
        }

        const options: SearchOption[] = agents.map(agent => ({
          value: agent.id,
          label: `${agent.first_name} ${agent.last_name}${agent.email ? ' - ' + agent.email : ''}${agent.status === 'pre-invite' ? ' (Pre-invite)' : ''}`,
          status: agent.status
        }))

        console.log('[ONBOARDING] Mapped to', options.length, 'options')
        setNameSearchResults(options)
      } catch (error) {
        console.error('[ONBOARDING] Name search exception:', error)
        setNameSearchResults([])
      } finally {
        setIsNameSearching(false)
      }
    }, 400)

    return () => clearTimeout(debounceTimer)
  }, [nameSearchTerm])

  // Check for existing uploaded files when user is admin
  useEffect(() => {
    if (userData.is_admin && currentStep === 1) {
      checkExistingFiles()
    }
  }, [userData, currentStep])

  const checkExistingFiles = async () => {
    if (!userData.agency_id) return

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
      uplineAgentId: currentAgentForm.uplineAgentId || null,
      preInviteUserId: selectedPreInviteUserId
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
    setNameSearchTerm("")
    setSelectedPreInviteUserId(null)
    setShowAgentForm(false)
    setErrors([])
  }

  const handleRemoveAgent = (index: number) => {
    setInvitedAgents(invitedAgents.filter((_, i) => i !== index))
  }

  const handlePreInviteUserSelect = async (userId: string, selectedOption: SearchOption) => {
    try {
      console.log('[ONBOARDING] Selecting pre-invite user:', userId)

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !user) {
        console.error('[ONBOARDING] Error fetching user:', error)
        setErrors(['Failed to load user data'])
        return
      }

      console.log('[ONBOARDING] User data loaded:', user)

      // Pre-fill the form with user data
      setCurrentAgentForm({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        email: user.email || "",
        phoneNumber: user.phone_number || "",
        permissionLevel: user.perm_level || "",
        uplineAgentId: user.upline_id || ""
      })

      setSelectedPreInviteUserId(userId)
      setNameSearchTerm(selectedOption.label)
      setNameSearchResults([])

      // If there's an upline, set the search term for upline field
      if (user.upline_id) {
        const uplineOption = agentSearchResults.find(r => r.value === user.upline_id)
        if (uplineOption) {
          setAgentSearchTerm(uplineOption.label)
        }
      }
    } catch (error) {
      console.error('[ONBOARDING] Error selecting pre-invite user:', error)
      setErrors(['Failed to load user data'])
    }
  }

  const uploadPolicyReports = async () => {
    const uploadedFiles = uploads.filter(u => u.file !== null) as Array<{ carrier: string; file: File }>;
    if (uploadedFiles.length === 0) {
      return { success: true, message: 'No files to upload' }
    }

    try {
      // 0) Create an ingest job first
      const expectedFiles = uploadedFiles.length
      const clientJobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      // Resolve agencyId from current session
      let agencyId: string | null = null
      try {
        const { data: auth } = await supabase.auth.getUser()
        const userId = auth?.user?.id
        if (userId) {
          const { data: userRow, error: userError } = await supabase
            .from('users')
            .select('agency_id')
            .eq('auth_user_id', userId)
            .single()
          if (!userError) {
            agencyId = userRow?.agency_id ?? null
          }
        }
      } catch {}

      if (!agencyId) {
        return { success: false, message: 'Could not resolve your agency. Please refresh and try again.' }
      }

      const jobResp = await fetch('/api/upload-policy-reports/create-job', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          expectedFiles,
          clientJobId,
        }),
      })
      const jobJson = await jobResp.json().catch(() => null)
      if (!jobResp.ok || !jobJson?.job?.jobId) {
        console.error('Failed to create ingest job', { status: jobResp.status, body: jobJson })
        return { success: false, message: 'Could not start ingest job. Please try again.' }
      }
      const jobId = jobJson.job.jobId as string
      console.debug('Created ingest job', { jobId, expectedFiles })

      // 1) Request presigned URLs for all files in a single call (new ingestion flow)
      const signResp = await fetch('/api/upload-policy-reports/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobId,
          files: uploadedFiles.map(({ file }) => ({
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            size: file.size,
          })),
        }),
      })
      const signJson = await signResp.json().catch(() => null)
      if (!signResp.ok || !Array.isArray(signJson?.files)) {
        console.error('Presign failed', { status: signResp.status, body: signJson })
        return { success: false, message: 'Could not generate upload URLs. Please try again.' }
      }

      // 2) Upload each file via its presigned URL (no chunking; URLs expire in 60s)
      const results = await Promise.allSettled(
        (signJson.files as Array<{ fileId: string; fileName: string; presignedUrl: string }>).
          map(async (f) => {
            const match = uploadedFiles.find(uf => uf.file.name === f.fileName)
            if (!match) throw new Error(`Missing file for ${f.fileName}`)
            const res = await putToSignedUrl(f.presignedUrl, match.file)
            if (!res.ok) throw new Error(`Upload failed with status ${res.status}`)
            return { fileName: f.fileName, fileId: f.fileId }
          })
      )

      // 3) Summarize uploads
      const successes: { carrier: string; file: string; paths: string[] }[] = [];
      const failures: string[] = [];

      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          successes.push({ carrier: 'n/a', file: r.value.fileName, paths: [] });
        } else {
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
          failures.push(reason)
        }
      })

      if (successes.length) console.log('Uploaded:', successes);
      if (failures.length) console.error('Failed uploads:', failures);

      if (failures.length === 0) {
        return {
          success: true,
          message: `Successfully uploaded ${successes.length} file(s).`
        }
      } else {
        return {
          success: false,
          message: `Uploaded ${successes.length} file(s), but ${failures.length} failed: ${failures.join(', ')}`
        }
      }
    } catch (err) {
      console.error('Unexpected error during upload:', err);
      return { success: false, message: 'An unexpected error occurred while uploading. Please try again.' }
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
            uplineAgentId: agent.uplineAgentId || currentUserId,
            preInviteUserId: agent.preInviteUserId // Include pre-invite user ID if updating
          }),
          credentials: 'include'
        })

        const data = await response.json()

        if (response.ok) {
          const action = agent.preInviteUserId ? 'updated' : 'invited'
          results.push(`✓ ${agent.firstName} ${agent.lastName} (${action})`)
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
        ? `Successfully processed ${results.length} agent(s)!`
        : `Processed ${results.length} agent(s), ${errors.length} failed: ${errors.join(', ')}`
    }
  }

  const handleComplete = async () => {
    setSubmitting(true)
    setErrors([])

    try {
      // Upload policy reports if admin
      if (userData.is_admin) {
        const uploadResult = await uploadPolicyReports()
        if (!uploadResult.success) {
          console.error('Policy upload warning:', uploadResult.message)
          // Continue anyway, just log the warning
        }
      }

      // Invite agents
      const inviteResult = await inviteAgents(userData.id)
      if (!inviteResult.success) {
        console.error('Agent invitation warning:', inviteResult.message)
        // Continue anyway, just log the warning
      }

      // Update user status to 'active'
      const { error: updateError } = await supabase
        .from('users')
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userData.id)

      if (updateError) {
        console.error('Error updating user status:', updateError)
        setErrors(['Failed to complete onboarding. Please try again.'])
        return
      }

      // Success! Call onComplete callback
      onComplete()
    } catch (error) {
      console.error('Error during onboarding completion:', error)
      setErrors(['Failed to complete onboarding. Please try again.'])
    } finally {
      setSubmitting(false)
    }
  }

  const nextStep = () => {
    setErrors([])
    setCurrentStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const prevStep = () => {
    setErrors([])
    setCurrentStep(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const skipToComplete = () => {
    handleComplete()
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gradient mb-2">
            Complete Your Setup
          </h1>
          <p className="text-muted-foreground">
            {userData.is_admin
              ? 'Upload policy reports and invite your team to get started'
              : 'Invite your team members to get started'
            }
          </p>
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
          {/* Step 1: Upload Policy Reports (Admin only) */}
          {currentStep === 1 && userData.is_admin && (
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
                  <strong>Optional:</strong> You can skip this step and upload reports later in the Configuration page.
                </AlertDescription>
              </Alert>

              {/* Navigation */}
              <div className="flex justify-between items-center pt-6 mt-8 border-t border-border">
                <div></div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={nextStep}
                    className="h-12 px-6"
                  >
                    Skip for Now
                  </Button>
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="h-12 px-6 btn-gradient"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Add Team Members */}
          {currentStep === 2 && (
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
                          {agent.preInviteUserId && (
                            <span className="ml-2 text-xs text-blue-500 font-normal">(Updating existing)</span>
                          )}
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
                        setNameSearchTerm("")
                        setSelectedPreInviteUserId(null)
                        setErrors([])
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Name Search for Pre-invite Users */}
                  <div className="space-y-2 p-3 bg-accent/20 rounded-lg border border-border">
                    <label className="block text-sm font-semibold text-foreground">
                      Search by Name (Optional)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Search for an existing pre-invite user to update their information, or leave blank to create a new user.
                    </p>
                    <div className="relative">
                      <Input
                        type="text"
                        value={nameSearchTerm}
                        onChange={(e) => {
                          setNameSearchTerm(e.target.value)
                          // Clear selection if user changes search
                          if (selectedPreInviteUserId) {
                            setSelectedPreInviteUserId(null)
                            setCurrentAgentForm({
                              firstName: "",
                              lastName: "",
                              email: "",
                              phoneNumber: "",
                              permissionLevel: "",
                              uplineAgentId: ""
                            })
                          }
                        }}
                        className="h-10"
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
                      <div className="border border-border rounded-lg bg-card shadow-lg max-h-40 overflow-y-auto z-10">
                        {nameSearchResults.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-accent/50 border-b border-border last:border-b-0 text-sm transition-colors"
                            onClick={() => handlePreInviteUserSelect(option.value, option)}
                          >
                            <div className="text-sm font-medium text-foreground">
                              {option.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* No results message */}
                    {nameSearchTerm.length >= 2 && !isNameSearching && nameSearchResults.length === 0 && (
                      <div className="border border-border rounded-lg bg-card shadow-lg p-3 z-10">
                        <p className="text-sm text-muted-foreground text-center">
                          No agents found matching "{nameSearchTerm}"
                        </p>
                      </div>
                    )}

                    {/* Selected pre-invite user indicator */}
                    {selectedPreInviteUserId && (
                      <div className="mt-2 p-2 bg-blue-500/20 rounded border border-blue-500/30">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-blue-400">
                            Updating existing user: {currentAgentForm.firstName} {currentAgentForm.lastName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPreInviteUserId(null)
                              setNameSearchTerm("")
                              setCurrentAgentForm({
                                firstName: "",
                                lastName: "",
                                email: "",
                                phoneNumber: "",
                                permissionLevel: "",
                                uplineAgentId: ""
                              })
                            }}
                            className="text-destructive hover:text-destructive/80 text-xs"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    )}
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
                        className={`h-10 ${selectedPreInviteUserId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        readOnly={!!selectedPreInviteUserId}
                        disabled={!!selectedPreInviteUserId}
                      />
                      {selectedPreInviteUserId && (
                        <p className="text-xs text-muted-foreground">Name cannot be changed for existing users</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-foreground">
                        Last Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="text"
                        value={currentAgentForm.lastName}
                        onChange={(e) => setCurrentAgentForm({ ...currentAgentForm, lastName: e.target.value })}
                        className={`h-10 ${selectedPreInviteUserId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        readOnly={!!selectedPreInviteUserId}
                        disabled={!!selectedPreInviteUserId}
                      />
                      {selectedPreInviteUserId && (
                        <p className="text-xs text-muted-foreground">Name cannot be changed for existing users</p>
                      )}
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

              {/* Navigation */}
              <div className="flex justify-between items-center pt-6 mt-8 border-t border-border">
                {userData.is_admin && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    className="h-12 px-6"
                  >
                    Previous
                  </Button>
                )}
                {!userData.is_admin && <div></div>}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={skipToComplete}
                    disabled={submitting}
                    className="h-12 px-6"
                  >
                    Skip for Now
                  </Button>
                  <Button
                    type="button"
                    onClick={handleComplete}
                    disabled={submitting}
                    className="h-12 px-6 btn-gradient"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Complete Setup
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

