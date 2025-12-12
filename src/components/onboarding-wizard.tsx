'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, Users, Loader2, X, FileText, Plus, CheckCircle2, Shield, AlertCircle, Clock } from "lucide-react"
import { Progress } from "@/components/ui/progress"
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
  'Transamerica',
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

  // Agency branding state
  const [primaryColor, setPrimaryColor] = useState<string>("217 91% 60%")

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

  // NIPR verification state
  const [niprForm, setNiprForm] = useState({
    lastName: '',
    npn: '',
    ssn: '',
    dob: ''
  })
  const [niprRunning, setNiprRunning] = useState(false)
  const [niprResult, setNiprResult] = useState<{
    success: boolean
    message: string
    files?: string[]
    analysis?: {
      success: boolean
      carriers: string[]
      licensedStates: { resident: string[]; nonResident: string[] }
      analyzedAt: string
    }
  } | null>(null)

  // NIPR job progress tracking
  const [niprJobId, setNiprJobId] = useState<string | null>(null)
  const [niprProgress, setNiprProgress] = useState(0)
  const [niprProgressMessage, setNiprProgressMessage] = useState('')
  const [niprQueuePosition, setNiprQueuePosition] = useState<number | null>(null)

  // Carrier upload progress state (for step-by-step upload)
  const [currentCarrierIndex, setCurrentCarrierIndex] = useState(0)
  const [carrierUploads, setCarrierUploads] = useState<Record<string, File | null>>({})
  const [uploadingCarrier, setUploadingCarrier] = useState(false)

  // Matched carriers state (filtered by fuzzy matching with active carriers)
  const [matchedCarriers, setMatchedCarriers] = useState<Array<{
    id: string
    name: string
    display_name: string
    matchedWith: string
    similarity: number
  }>>([])
  const [loadingMatches, setLoadingMatches] = useState(false)

  // NIPR already completed state
  const [niprAlreadyCompleted, setNiprAlreadyCompleted] = useState(false)
  const [storedCarriers, setStoredCarriers] = useState<string[]>([])

  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState(1) // All users start at NIPR verification
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (errors.length > 0 && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [errors])

  // Fetch agency primary color
  useEffect(() => {
    const fetchAgencyColor = async () => {
      if (userData.agency_id) {
        const { data: agencyData } = await supabase
          .from('agencies')
          .select('primary_color')
          .eq('id', userData.agency_id)
          .single()

        if (agencyData?.primary_color) {
          setPrimaryColor(agencyData.primary_color)
        }
      }
    }
    fetchAgencyColor()
  }, [userData.agency_id, supabase])

  // Agent search debounce (for upline selection)
  useEffect(() => {
    if (agentSearchTerm.length < 2) {
      setAgentSearchResults([])
      return
    }

    const debounceTimer = setTimeout(async () => {
      try {
        setIsSearching(true)
        const response = await fetch(`/api/search-agents?q=${encodeURIComponent(agentSearchTerm)}&limit=10&type=downline`, {
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

        const response = await fetch(`/api/search-agents?q=${encodeURIComponent(nameSearchTerm)}&limit=10&type=pre-invite`, {
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

  // Check for existing uploaded files when on step 2
  useEffect(() => {
    if (currentStep === 2) {
      checkExistingFiles()
    }
  }, [currentStep])

  // Check if NIPR has already been completed for this user
  useEffect(() => {
    const checkNiprStatus = async () => {
      if (!userData.id) return

      try {
        const response = await fetch('/api/nipr/status')
        if (!response.ok) return

        const { completed, carriers } = await response.json()

        if (completed && carriers.length > 0) {
          setNiprAlreadyCompleted(true)
          setStoredCarriers(carriers)
          // Auto-advance if on step 1
          // Admins go to policy upload (step 2), agents skip to invite team (step 3)
          if (currentStep === 1) {
            setCurrentStep(userData.is_admin ? 2 : 3)
          }
        }
      } catch (error) {
        console.error('[ONBOARDING] Error checking NIPR status:', error)
      }
    }

    checkNiprStatus()
  }, [userData.id])

  // Poll for NIPR job progress when we have a job ID
  useEffect(() => {
    if (!niprJobId || !niprRunning) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/nipr/job/${niprJobId}`)
        if (!response.ok) return

        const job = await response.json()

        setNiprProgress(job.progress || 0)
        setNiprProgressMessage(job.progressMessage || '')
        setNiprQueuePosition(job.position || null)

        // If job is completed or failed, stop polling and handle result
        if (job.status === 'completed') {
          setNiprRunning(false)
          setNiprResult({
            success: true,
            message: 'NIPR verification completed successfully!',
            files: job.resultFiles,
            analysis: {
              success: true,
              carriers: job.resultCarriers || [],
              unique_carriers: job.resultCarriers || [],
              licensedStates: { resident: [], nonResident: [] },
              analyzedAt: job.completedAt
            }
          })

          // Store carriers if we have them
          if (job.resultCarriers && job.resultCarriers.length > 0 && userData.id) {
            await storeCarriersInDatabase(job.resultCarriers, userData.id)
          }

          // Auto-advance to next step
          setTimeout(() => {
            setCurrentStep(userData.is_admin ? 2 : 3)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }, 2000)

          clearInterval(pollInterval)
        } else if (job.status === 'failed') {
          setNiprRunning(false)
          setNiprResult({
            success: false,
            message: job.errorMessage || 'NIPR verification failed. Please try again.'
          })
          clearInterval(pollInterval)
        }
      } catch (error) {
        console.error('[ONBOARDING] Error polling job status:', error)
      }
    }, 10000) // Poll every 10 seconds

    return () => clearInterval(pollInterval)
  }, [niprJobId, niprRunning, userData.id, userData.is_admin])

  // Fetch active carriers and match with NIPR results when entering step 2
  useEffect(() => {
    const fetchAndMatchCarriers = async () => {
      // Get carriers to match - either from NIPR result or stored carriers
      const carriersToMatch = niprResult?.analysis?.unique_carriers || storedCarriers

      if (!carriersToMatch || carriersToMatch.length === 0 || currentStep !== 2) {
        return
      }

      setLoadingMatches(true)
      try {
        // Fetch active carriers from API
        const response = await fetch('/api/carriers')
        if (!response.ok) {
          console.error('[ONBOARDING] Failed to fetch carriers')
          return
        }

        const activeCarriers = await response.json()

        // Import and use fuzzy matching
        const { findMatchingCarriers } = await import('@/lib/nipr/fuzzy-match')
        const matches = findMatchingCarriers(
          carriersToMatch,
          activeCarriers,
          0.8 // 80% threshold
        )

        console.log('[ONBOARDING] Matched carriers:', matches.length, 'out of', carriersToMatch.length, 'NIPR carriers')
        setMatchedCarriers(matches)
      } catch (error) {
        console.error('[ONBOARDING] Error matching carriers:', error)
      } finally {
        setLoadingMatches(false)
      }
    }

    if (currentStep === 2) {
      fetchAndMatchCarriers()
    }
  }, [currentStep, niprResult, storedCarriers])

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

  // Store NIPR carriers in database (non-blocking)
  const storeCarriersInDatabase = async (carriers: string[], userId: string) => {
    try {
      // Validate inputs
      if (!userId || !userId.trim()) {
        console.warn('[ONBOARDING] Cannot store carriers: Invalid user ID')
        return
      }

      if (!Array.isArray(carriers)) {
        console.warn('[ONBOARDING] Cannot store carriers: Invalid carriers data type')
        return
      }

      // Filter and clean carriers array
      const validCarriers = carriers
        .filter(carrier => carrier && typeof carrier === 'string' && carrier.trim().length > 0)
        .map(carrier => carrier.trim())

      if (validCarriers.length === 0) {
        console.warn('[ONBOARDING] No valid carriers to store')
        return
      }

      console.log('[ONBOARDING] Storing carriers in database:', validCarriers)

      const { error } = await supabase
        .from('users')
        .update({ unique_carriers: validCarriers })
        .eq('id', userId)

      if (error) {
        console.error('[ONBOARDING] Failed to store NIPR carriers:', error)
        // Non-blocking error - UI flow continues
      } else {
        console.log('[ONBOARDING] Successfully stored NIPR carriers:', validCarriers.length, 'carriers for user', userId)
      }
    } catch (error) {
      console.error('[ONBOARDING] Database storage error:', error)
      // Non-blocking error - UI flow continues
    }
  }

  // NIPR automation handler
  const runNiprAutomation = async () => {
    setErrors([])
    setNiprRunning(true)
    setNiprResult(null)
    setNiprJobId(null)
    setNiprProgress(0)
    setNiprProgressMessage('Submitting verification request...')
    setNiprQueuePosition(null)

    try {
      // Validate form
      const validationErrors: string[] = []
      if (!niprForm.lastName.trim()) validationErrors.push('Last name is required')
      if (!niprForm.npn.trim()) validationErrors.push('NPN is required')
      if (!/^\d+$/.test(niprForm.npn)) validationErrors.push('NPN must be numeric')
      if (!niprForm.ssn.trim()) validationErrors.push('Last 4 SSN is required')
      if (!/^\d{4}$/.test(niprForm.ssn)) validationErrors.push('SSN must be exactly 4 digits')
      if (!niprForm.dob.trim()) validationErrors.push('Date of birth is required')
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(niprForm.dob)) validationErrors.push('DOB must be in MM/DD/YYYY format')

      if (validationErrors.length > 0) {
        setErrors(validationErrors)
        setNiprRunning(false)
        return
      }

      const response = await fetch('/api/nipr/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(niprForm)
      })

      const result = await response.json()

      // Handle rate limit error specifically
      if (response.status === 429) {
        const retryMinutes = Math.ceil((result.retryAfter || 3600) / 60)
        setNiprResult({
          success: false,
          message: `Rate limit exceeded. Please try again in ${retryMinutes} minute${retryMinutes !== 1 ? 's' : ''}.`
        })
        setNiprRunning(false)
        return
      }

      // Handle conflict (already has pending job)
      if (response.status === 409) {
        // Already has a pending job - start polling it
        if (result.jobId) {
          setNiprJobId(result.jobId)
          setNiprProgressMessage(result.status === 'processing' ? 'Verification in progress...' : 'Waiting in queue...')
        }
        return
      }

      // Handle other errors
      if (!response.ok && !result.queued) {
        setNiprResult({
          success: false,
          message: result.error || 'NIPR verification failed. Please try again.'
        })
        setNiprRunning(false)
        return
      }

      // If job was queued (waiting for another job to finish), start polling
      if (result.queued && result.jobId) {
        setNiprJobId(result.jobId)
        setNiprQueuePosition(result.position || null)
        setNiprProgressMessage(`Waiting in queue (position ${result.position || '?'})...`)
        // The useEffect will handle polling
        return
      }

      // If job started processing, start polling for progress
      if (result.processing && result.jobId) {
        setNiprJobId(result.jobId)
        setNiprProgressMessage('Starting verification...')
        // The useEffect will handle polling
        return
      }

      // Job completed immediately (legacy mode or already completed)
      // Store carriers in database if analysis was successful
      if (result.success && result.analysis?.unique_carriers && userData.id) {
        // Additional validation before storage
        if (Array.isArray(result.analysis.unique_carriers) && result.analysis.unique_carriers.length > 0) {
          console.log('[ONBOARDING] NIPR analysis found', result.analysis.unique_carriers.length, 'carriers, storing to database...')
          await storeCarriersInDatabase(result.analysis.unique_carriers, userData.id)
        } else {
          console.warn('[ONBOARDING] NIPR analysis returned no carriers to store')
        }
      }

      setNiprResult(result)
      setNiprRunning(false)
      setNiprProgress(100)
      setNiprProgressMessage('Complete!')

      if (result.success) {
        // Auto-advance to next step after success
        // Admins go to policy upload (step 2), agents skip to invite team (step 3)
        setTimeout(() => {
          setCurrentStep(userData.is_admin ? 2 : 3)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }, 2000)
      }
    } catch (error) {
      console.error('NIPR automation error:', error)
      setNiprRunning(false)
      setNiprResult({
        success: false,
        message: 'Failed to run NIPR automation. Please try again.'
      })
    }
  }

  const goToStep = (step: number) => {
    setErrors([])
    setCurrentStep(step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const nextStep = () => {
    setErrors([])
    setCurrentStep(prev => prev + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const prevStep = () => {
    setErrors([])
    setCurrentStep(prev => prev - 1)
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
          <h1 className="text-4xl font-bold mb-2" style={{ color: `hsl(${primaryColor})` }}>
            Complete Your Setup
          </h1>
          <p className="text-muted-foreground">
            Verify your credentials, upload policy reports, and invite your team to get started
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
        <div className="bg-card rounded-lg shadow-lg border border-border p-8">
          {/* Step 1: NIPR Verification */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8 text-primary" />
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">NIPR Verification</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter your National Insurance Producer Registry information to verify your credentials
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Last Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    value={niprForm.lastName}
                    onChange={(e) => setNiprForm({ ...niprForm, lastName: e.target.value })}
                    className="h-10"
                    placeholder="Enter your last name"
                    disabled={niprRunning}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    NPN (National Producer Number) <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    value={niprForm.npn}
                    onChange={(e) => setNiprForm({ ...niprForm, npn: e.target.value.replace(/\D/g, '') })}
                    className="h-10"
                    placeholder="e.g., 12345678"
                    disabled={niprRunning}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Last 4 digits of SSN <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="password"
                    value={niprForm.ssn}
                    onChange={(e) => setNiprForm({ ...niprForm, ssn: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    className="h-10"
                    placeholder="XXXX"
                    maxLength={4}
                    disabled={niprRunning}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Date of Birth <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    value={niprForm.dob}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^\d/]/g, '')
                      // Auto-format as MM/DD/YYYY
                      if (value.length === 2 && !value.includes('/')) {
                        value = value + '/'
                      } else if (value.length === 5 && value.charAt(2) === '/' && !value.slice(3).includes('/')) {
                        value = value + '/'
                      }
                      setNiprForm({ ...niprForm, dob: value.slice(0, 10) })
                    }}
                    className="h-10"
                    placeholder="MM/DD/YYYY"
                    maxLength={10}
                    disabled={niprRunning}
                  />
                </div>
              </div>

              {/* NIPR Progress Bar */}
              {niprRunning && (
                <div className="space-y-4 p-6 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    {niprQueuePosition ? (
                      <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-foreground">
                          {niprQueuePosition
                            ? `Waiting in queue (position ${niprQueuePosition})`
                            : 'NIPR Verification in Progress'}
                        </span>
                        <span className="text-sm text-muted-foreground">{niprProgress}%</span>
                      </div>
                      <Progress value={niprProgress} className="h-2" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        {niprProgressMessage || 'Processing...'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Please do not close this page. This process typically takes 3-5 minutes.
                  </p>
                </div>
              )}

              {/* NIPR Result */}
              {niprResult && !niprRunning && (
                <Alert className={niprResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                  <AlertDescription className={niprResult.success ? "text-green-800" : "text-red-800"}>
                    <div className="flex items-center gap-2">
                      {niprResult.success ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <AlertCircle className="h-5 w-5" />
                      )}
                      <span>{niprResult.message}</span>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {!niprRunning && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertDescription className="text-amber-800">
                    <strong>Note:</strong> This verification process takes 3-5 minutes to complete. You can skip this step and complete it later.
                  </AlertDescription>
                </Alert>
              )}

              {/* Navigation */}
              <div className="flex justify-between items-center pt-6 mt-8 border-t border-border">
                <div></div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => goToStep(userData.is_admin ? 2 : 3)}
                    disabled={niprRunning}
                    className="h-12 px-6"
                  >
                    Skip for Now
                  </Button>
                  <Button
                    type="button"
                    onClick={runNiprAutomation}
                    disabled={niprRunning}
                    className="h-12 px-6 bg-black hover:bg-black/90 text-white"
                  >
                    {niprRunning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running Verification...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Run Verification
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Upload Policy Reports - Step by Step */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Loading state while matching carriers */}
              {loadingMatches ? (
                <div className="text-center py-12 space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground">Matching carriers with your licenses...</p>
                </div>
              ) : matchedCarriers.length > 0 ? (
                <>
                  {/* Minimal Progress Bar */}
                  <div className="space-y-2">
                    <div className="w-full h-1 bg-gray-200 rounded-full">
                      <div
                        className="h-1 bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${((currentCarrierIndex + 1) / matchedCarriers.length) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      {Math.round(((currentCarrierIndex + 1) / matchedCarriers.length) * 100)}% complete
                      <span className="mx-2">•</span>
                      {currentCarrierIndex + 1} of {matchedCarriers.length} carriers
                    </p>
                  </div>

                  {/* Current Carrier Upload */}
                  <div className="text-center space-y-6 py-8">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        Upload Document for:
                      </h2>
                      <p className="text-3xl font-bold text-primary mt-2">
                        {matchedCarriers[currentCarrierIndex]?.display_name}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Matched from: {matchedCarriers[currentCarrierIndex]?.matchedWith}
                      </p>
                    </div>

                    <div className="max-w-md mx-auto">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-primary transition-colors">
                        {carrierUploads[matchedCarriers[currentCarrierIndex]?.id] ? (
                          <div className="text-center">
                            <FileText className="h-16 w-16 text-primary mx-auto mb-4" />
                            <p className="text-sm font-medium text-foreground mb-1">
                              {carrierUploads[matchedCarriers[currentCarrierIndex]?.id]?.name}
                            </p>
                            <p className="text-xs text-muted-foreground mb-4">
                              {((carrierUploads[matchedCarriers[currentCarrierIndex]?.id]?.size || 0) / 1024).toFixed(2)} KB
                            </p>
                            <Button
                              onClick={() => {
                                const carrierId = matchedCarriers[currentCarrierIndex]?.id
                                setCarrierUploads(prev => ({ ...prev, [carrierId]: null }))
                              }}
                              variant="outline"
                              size="sm"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                            <p className="text-lg font-medium text-foreground mb-2">
                              Drop file here or click to upload
                            </p>
                            <p className="text-sm text-muted-foreground mb-4">
                              CSV or Excel file
                            </p>
                            <input
                              type="file"
                              accept=".csv,.xlsx,.xls"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  const carrierId = matchedCarriers[currentCarrierIndex]?.id
                                  setCarrierUploads(prev => ({ ...prev, [carrierId]: file }))
                                }
                              }}
                              className="hidden"
                              id="carrier-upload"
                            />
                            <label
                              htmlFor="carrier-upload"
                              className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-lg text-sm font-medium inline-block"
                            >
                              Choose File
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between items-center pt-6 border-t border-border">
                    <div>
                      {currentCarrierIndex > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCurrentCarrierIndex(i => i - 1)}
                          className="h-12 px-6"
                        >
                          Previous Carrier
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          // Skip this carrier
                          if (currentCarrierIndex < matchedCarriers.length - 1) {
                            setCurrentCarrierIndex(i => i + 1)
                          } else {
                            goToStep(3)
                          }
                        }}
                        className="h-12 px-6"
                      >
                        Skip
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          if (currentCarrierIndex < matchedCarriers.length - 1) {
                            setCurrentCarrierIndex(i => i + 1)
                          } else {
                            goToStep(3)
                          }
                        }}
                        className="h-12 px-6 bg-black hover:bg-black/90 text-white"
                      >
                        {currentCarrierIndex === matchedCarriers.length - 1
                          ? "Next: Invite Team"
                          : "Next Carrier →"}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                /* Fallback: No matching carriers found - show skip option */
                <div className="text-center py-12 space-y-6">
                  <div className="text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h2 className="text-xl font-semibold text-foreground mb-2">No Matching Carriers Found</h2>
                    <p>
                      {(niprResult?.analysis?.unique_carriers?.length || storedCarriers.length) > 0
                        ? "None of your NIPR carriers match our active carrier list."
                        : "No carrier information was found from the NIPR verification."}
                      <br />
                      You can upload policy reports later from the Configuration page.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="h-12 px-8 bg-black hover:bg-black/90 text-white"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Next: Invite Team
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Add Team Members */}
          {currentStep === 3 && (
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
                    className="w-full bg-black hover:bg-black/90 text-white"
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => goToStep(userData.is_admin ? 2 : 1)}
                  className="h-12 px-6"
                >
                  Previous
                </Button>
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
                    className="h-12 px-6 bg-black hover:bg-black/90 text-white"
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

