'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users, Loader2, X, Plus, CheckCircle2, Shield, AlertCircle, Clock, Upload, FileText } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { putToSignedUrl } from '@/lib/upload-policy-reports/client'
import { withTimeout } from '@/lib/auth/constants'
import { RateLimitError } from '@/lib/error-utils'
import { useQuery } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/useApiFetch'
import { queryKeys } from '@/hooks/queryKeys'
import {
  useInviteAgent,
  useRunNiprAutomation,
  useUploadNiprDocument,
  useCreateOnboardingPolicyJob,
  useSignOnboardingPolicyFiles,
} from '@/hooks/mutations'

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
  'Foresters',
  'Reagan CRM Data',
  'Ethos',
  'Mutual of Omaha',
  'Americo',
]

const permissionLevels = [
  { value: "agent", label: "Agent" },
  { value: "admin", label: "Admin" }
]

// localStorage key for persisting NIPR job ID across page refresh
const NIPR_JOB_STORAGE_KEY = 'nipr_active_job_id'

interface OnboardingWizardProps {
  userData: UserData
  onComplete: () => void
}

export default function OnboardingWizard({ userData, onComplete }: OnboardingWizardProps) {
  const supabase = createClient()
  const router = useRouter()

  // Agency branding state
  const [primaryColor, setPrimaryColor] = useState<string>("217 91% 60%")

  // Policy reports upload state (used by uploadPolicyReports in handleComplete)
  const [uploads, setUploads] = useState<CarrierUpload[]>(
    carriers.map(carrier => ({ carrier, file: null }))
  )

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
      unique_carriers?: string[]
      licensedStates: { resident: string[]; nonResident: string[] }
      analyzedAt: string
    }
  } | null>(null)

  // NIPR job progress tracking
  const [niprJobId, setNiprJobId] = useState<string | null>(null)
  const [niprProgress, setNiprProgress] = useState(0)
  const [niprProgressMessage, setNiprProgressMessage] = useState('')
  const [niprQueuePosition, setNiprQueuePosition] = useState<number | null>(null)

  // NIPR upload mode state (alternative to automation)
  const [niprMode, setNiprMode] = useState<'upload' | 'automation'>('automation')
  const [niprUploadFile, setNiprUploadFile] = useState<File | null>(null)
  const [niprDragging, setNiprDragging] = useState(false)

  // Note: Carrier login collection (Step 2) was intentionally removed from the onboarding flow
  // See commit ae00c67 in main branch for details

  // NIPR already completed state
  const [niprAlreadyCompleted, setNiprAlreadyCompleted] = useState(false)
  const [storedCarriers, setStoredCarriers] = useState<string[]>([])

  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState(1) // All users start at NIPR verification
  const errorRef = useRef<HTMLDivElement>(null)

  // ============ Mutation Hooks ============
  const inviteAgentMutation = useInviteAgent()
  const runNiprMutation = useRunNiprAutomation()
  const uploadNiprMutation = useUploadNiprDocument()
  const createPolicyJobMutation = useCreateOnboardingPolicyJob()
  const signPolicyFilesMutation = useSignOnboardingPolicyFiles()

  // Derived loading states from mutations
  const niprUploading = uploadNiprMutation.isPending

  useEffect(() => {
    if (errors.length > 0 && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [errors])

  // Fetch agency primary color
  const { data: agencyData } = useQuery({
    queryKey: queryKeys.agencyColor(userData.agency_id || ''),
    queryFn: async () => {
      const { data } = await supabase
        .from('agencies')
        .select('primary_color')
        .eq('id', userData.agency_id)
        .single()
      return data
    },
    enabled: !!userData.agency_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  useEffect(() => {
    if (agencyData?.primary_color) {
      setPrimaryColor(agencyData.primary_color)
    }
  }, [agencyData])

  // Check for active NIPR job on mount (for page refresh resilience)
  const savedJobId = typeof window !== 'undefined' ? localStorage.getItem(NIPR_JOB_STORAGE_KEY) : null

  const { data: activeJobData } = useQuery({
    queryKey: queryKeys.niprJob(savedJobId || ''),
    queryFn: async () => {
      if (!savedJobId) return null

      const response = await fetch(`/api/nipr/job/${savedJobId}`)
      if (!response.ok) {
        localStorage.removeItem(NIPR_JOB_STORAGE_KEY)
        return null
      }

      return response.json()
    },
    enabled: !!savedJobId,
    staleTime: 0,
    retry: false,
  })

  useEffect(() => {
    if (!activeJobData) return

    if (activeJobData.status === 'processing' || activeJobData.status === 'pending') {
      // Resume polling - job is still active
      setNiprJobId(savedJobId)
      setNiprRunning(true)
      setNiprProgress(activeJobData.progress || 0)
      setNiprProgressMessage(activeJobData.progressMessage || 'Resuming verification...')
      if (activeJobData.queuePosition) {
        setNiprQueuePosition(activeJobData.queuePosition)
      }
    } else {
      // Job completed or failed, clear storage
      localStorage.removeItem(NIPR_JOB_STORAGE_KEY)
    }
  }, [activeJobData, savedJobId])

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

  // Check if NIPR has already been completed for this user
  const { data: niprStatusData } = useApiFetch<{ completed: boolean; carriers: string[] }>(
    queryKeys.niprStatus(userData.id),
    '/api/nipr/status',
    {
      enabled: !!userData.id,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: false,
    }
  )

  useEffect(() => {
    if (niprStatusData?.completed && niprStatusData.carriers.length > 0) {
      setNiprAlreadyCompleted(true)
      setStoredCarriers(niprStatusData.carriers)
      // Auto-advance if on step 1
      // Admins go to policy upload (step 2), agents skip to invite team (step 3)
      if (currentStep === 1) {
        setCurrentStep(3)
      }
    }
  }, [niprStatusData, currentStep])

  // Auto-advance to step 3 when NIPR verification succeeds
  useEffect(() => {
    if (niprResult?.success && currentStep === 1 && !niprRunning && !niprUploading) {
      const timer = setTimeout(() => {
        setCurrentStep(3)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [niprResult?.success, currentStep, niprRunning, niprUploading])

  // Poll for NIPR job progress when we have a job ID
  const { data: niprJobData } = useQuery({
    queryKey: queryKeys.niprJob(niprJobId || ''),
    queryFn: async () => {
      if (!niprJobId) return null

      const response = await fetch(`/api/nipr/job/${niprJobId}`)
      if (!response.ok) return null

      return response.json()
    },
    enabled: !!niprJobId && niprRunning,
    refetchInterval: 30000, // Poll every 30 seconds - reduces server load
    staleTime: 0,
  })

  useEffect(() => {
    if (!niprJobData) return

    setNiprProgress(niprJobData.progress || 0)
    setNiprProgressMessage(niprJobData.progressMessage || '')
    setNiprQueuePosition(niprJobData.position || null)

    // If job is completed or failed, stop polling and handle result
    if (niprJobData.status === 'completed') {
      setNiprRunning(false)
      setNiprResult({
        success: true,
        message: 'NIPR verification completed successfully!',
        files: niprJobData.resultFiles,
        analysis: {
          success: true,
          carriers: niprJobData.resultCarriers || [],
          unique_carriers: niprJobData.resultCarriers || [],
          licensedStates: { resident: [], nonResident: [] },
          analyzedAt: niprJobData.completedAt
        }
      })

      // Store carriers if we have them
      if (niprJobData.resultCarriers && niprJobData.resultCarriers.length > 0 && userData.id) {
        storeCarriersInDatabase(niprJobData.resultCarriers, userData.id)
      }

      // Auto-advance to next step
      setTimeout(() => {
        setCurrentStep(3)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 2000)

      // Clear localStorage since job is complete
      localStorage.removeItem(NIPR_JOB_STORAGE_KEY)
    } else if (niprJobData.status === 'failed') {
      setNiprRunning(false)
      setNiprResult({
        success: false,
        message: niprJobData.errorMessage || 'NIPR verification failed. Please try again.'
      })
      // Clear localStorage since job failed
      localStorage.removeItem(NIPR_JOB_STORAGE_KEY)
    }
  }, [niprJobData, userData.id])

  // Note: Carrier login collection (Step 2) was intentionally removed - see commit ae00c67
  // The carrier matching and policy upload queries that were here are no longer needed

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

      // Create job using mutation
      const jobResult = await createPolicyJobMutation.mutateAsync({
        agencyId,
        expectedFiles,
        clientJobId,
      })

      if (!jobResult?.job?.jobId) {
        console.error('Failed to create ingest job', { body: jobResult })
        return { success: false, message: 'Could not start ingest job. Please try again.' }
      }
      const jobId = jobResult.job.jobId
      console.debug('Created ingest job', { jobId, expectedFiles })

      // 1) Request presigned URLs for all files in a single call (new ingestion flow)
      const signResult = await signPolicyFilesMutation.mutateAsync({
        jobId,
        files: uploadedFiles.map(({ file }) => ({
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
        })),
      })

      if (!Array.isArray(signResult?.files)) {
        console.error('Presign failed', { body: signResult })
        return { success: false, message: 'Could not generate upload URLs. Please try again.' }
      }

      // 2) Upload each file via its presigned URL (no chunking; URLs expire in 60s)
      const results = await Promise.allSettled(
        (signResult.files as Array<{ fileId: string; fileName: string; presignedUrl: string }>).
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

    const results: string[] = []
    const inviteErrors: string[] = []

    for (const agent of invitedAgents) {
      try {
        await inviteAgentMutation.mutateAsync({
          email: agent.email,
          firstName: agent.firstName,
          lastName: agent.lastName,
          phoneNumber: agent.phoneNumber,
          permissionLevel: agent.permissionLevel,
          uplineAgentId: agent.uplineAgentId || currentUserId,
          preInviteUserId: agent.preInviteUserId // Include pre-invite user ID if updating
        })

        const action = agent.preInviteUserId ? 'updated' : 'invited'
        results.push(`${agent.firstName} ${agent.lastName} (${action})`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Network error'
        inviteErrors.push(`${agent.firstName} ${agent.lastName}: ${errorMessage}`)
      }
    }

    return {
      success: inviteErrors.length === 0,
      message: inviteErrors.length === 0
        ? `Successfully processed ${results.length} agent(s)!`
        : `Processed ${results.length} agent(s), ${inviteErrors.length} failed: ${inviteErrors.join(', ')}`
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

      // Update user status to 'active' with timeout (Supabase client can hang)
      try {
        const result = await withTimeout(
          Promise.resolve(
            supabase
              .from('users')
              .update({
                status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', userData.id)
          )
        )

        if (result.error) {
          console.error('Error updating user status:', result.error)
        }
      } catch {
        // Timeout or error - continue to onComplete() which updates via server API
      }

      // Call onComplete callback (also updates status via server API as fallback)
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

    runNiprMutation.mutate(niprForm, {
      onSuccess: async (result) => {
        // Handle conflict (already has pending job)
        if (result.status === 'conflict') {
          // Already has a pending job - start polling it
          if (result.jobId) {
            localStorage.setItem(NIPR_JOB_STORAGE_KEY, result.jobId)
            setNiprJobId(result.jobId)
            // Check if the existing job is processing or still queued
            setNiprProgressMessage(result.processing ? 'Verification in progress...' : 'Waiting in queue...')
          }
          return
        }

        // If job was queued (waiting for another job to finish), start polling
        if (result.queued && result.jobId) {
          localStorage.setItem(NIPR_JOB_STORAGE_KEY, result.jobId)
          setNiprJobId(result.jobId)
          setNiprQueuePosition(result.position || null)
          setNiprProgressMessage(`Waiting in queue (position ${result.position || '?'})...`)
          // The useEffect will handle polling
          return
        }

        // If job started processing, start polling for progress
        if (result.processing && result.jobId) {
          localStorage.setItem(NIPR_JOB_STORAGE_KEY, result.jobId)
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

        setNiprResult({
          success: result.success || false,
          message: result.success ? 'NIPR verification completed!' : (result.error || 'NIPR verification failed'),
          analysis: result.analysis,
        })
        setNiprRunning(false)
        setNiprProgress(100)
        setNiprProgressMessage('Complete!')

        if (result.success) {
          // Auto-advance to next step after success
          // Admins go to policy upload (step 2), agents skip to invite team (step 3)
          setTimeout(() => {
            setCurrentStep(3)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }, 2000)
        }
      },
      onError: (error) => {
        console.error('NIPR automation error:', error)
        setNiprRunning(false)

        // Handle rate limit error with user-friendly message
        if (error instanceof RateLimitError) {
          const retryMinutes = Math.ceil(error.retryAfter / 60)
          setNiprResult({
            success: false,
            message: `Rate limit exceeded. Please try again in ${retryMinutes} minute${retryMinutes !== 1 ? 's' : ''}.`
          })
          return
        }

        setNiprResult({
          success: false,
          message: error.message || 'Failed to run NIPR automation. Please try again.'
        })
      },
    })
  }

  // NIPR document upload handler (faster alternative to automation)
  const uploadNiprDocument = async () => {
    if (!niprUploadFile) {
      setErrors(['Please select a PDF file to upload'])
      return
    }

    setErrors([])
    setNiprResult(null)

    uploadNiprMutation.mutate(niprUploadFile, {
      onSuccess: async (result) => {
        // Store carriers in database if analysis was successful
        if (result.analysis?.carriers && userData.id) {
          if (Array.isArray(result.analysis.carriers) && result.analysis.carriers.length > 0) {
            console.log('[ONBOARDING] NIPR upload found', result.analysis.carriers.length, 'carriers')
            await storeCarriersInDatabase(result.analysis.carriers, userData.id)
          }
        }

        setNiprResult({
          success: true,
          message: `Successfully extracted ${result.analysis?.carriers?.length || 0} carriers from your NIPR document`,
          analysis: {
            success: true,
            carriers: result.analysis?.carriers || [],
            unique_carriers: result.analysis?.carriers || [],
            licensedStates: result.analysis?.licensedStates || { resident: [], nonResident: [] },
            analyzedAt: result.analysis?.analyzedAt || new Date().toISOString()
          }
        })
        setNiprUploadFile(null)

        // Auto-advance to next step after success
        setTimeout(() => {
          setCurrentStep(3)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }, 2000)
      },
      onError: (error) => {
        console.error('NIPR upload error:', error)
        setNiprResult({
          success: false,
          message: error.message || 'Failed to upload NIPR document. Please try again.'
        })
      },
    })
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
          <h1 className="text-4xl font-bold mb-2 text-foreground dark:text-white">
            Complete Your Setup
          </h1>
          <p className="text-muted-foreground">
            Verify your credentials and invite your team to get started
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
                      Verify your credentials using your NIPR PDB report
                    </p>
                  </div>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <button
                  type="button"
                  onClick={() => setNiprMode('upload')}
                  disabled={niprRunning || niprUploading}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all ${
                    niprMode === 'upload'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Upload Document
                </button>
                <button
                  type="button"
                  onClick={() => setNiprMode('automation')}
                  disabled={niprRunning || niprUploading}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all ${
                    niprMode === 'automation'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  Auto-Retrieve
                </button>
              </div>

              {/* Upload Mode */}
              {niprMode === 'upload' && !niprRunning && !niprUploading && !niprResult?.success && (
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground">
                      Upload your NIPR PDB Detail Report PDF for instant verification
                    </p>
                  </div>

                  <div className="max-w-lg mx-auto">
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
                        niprUploadFile
                          ? 'border-primary bg-primary/5'
                          : niprDragging
                            ? 'border-primary bg-primary/10'
                            : 'border-gray-300 hover:border-primary'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setNiprDragging(true)
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setNiprDragging(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setNiprDragging(false)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setNiprDragging(false)

                        const files = e.dataTransfer.files
                        if (files && files.length > 0) {
                          const file = files[0]
                          if (file.name.toLowerCase().endsWith('.pdf')) {
                            setNiprUploadFile(file)
                          } else {
                            setErrors(['Please upload a PDF file'])
                          }
                        }
                      }}
                    >
                      {niprUploadFile ? (
                        <div className="text-center">
                          <FileText className="h-16 w-16 text-primary mx-auto mb-4" />
                          <p className="text-sm font-medium text-foreground mb-1">
                            {niprUploadFile.name}
                          </p>
                          <p className="text-xs text-muted-foreground mb-4">
                            {(niprUploadFile.size / 1024).toFixed(2)} KB
                          </p>
                          <Button
                            onClick={() => setNiprUploadFile(null)}
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
                            Drop your NIPR PDF here or click to upload
                          </p>
                          <p className="text-sm text-muted-foreground mb-4">
                            PDF file only (max 50MB)
                          </p>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                setNiprUploadFile(file)
                              }
                            }}
                            className="hidden"
                            id="nipr-upload"
                          />
                          <label
                            htmlFor="nipr-upload"
                            className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-lg text-sm font-medium inline-block"
                          >
                            Choose File
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription className="text-blue-800">
                      <strong>How to get your NIPR PDB Report:</strong> Log in to{' '}
                      <a href="https://pdb.nipr.com" target="_blank" rel="noopener noreferrer" className="underline">
                        pdb.nipr.com
                      </a>
                      , navigate to "PDB Detail Report", and download the PDF.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Automation Mode */}
              {niprMode === 'automation' && !niprUploading && !niprResult?.success && (
                <>
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

                  {!niprRunning && (
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertDescription className="text-amber-800">
                        <strong>Note:</strong> Auto-retrieval takes 4-6 minutes. We will automatically fetch your NIPR PDB report using your credentials.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {/* NIPR Progress Bar (Automation) */}
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
                    Please do not close this page. This process typically takes 4-6 minutes.
                  </p>
                </div>
              )}

              {/* Upload Progress */}
              {niprUploading && (
                <div className="space-y-4 p-6 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div className="flex-1">
                      <span className="font-medium text-foreground">Analyzing your NIPR document...</span>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Our AI is extracting carrier and license information from your document.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* NIPR Result */}
              {niprResult && !niprRunning && !niprUploading && (
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
                    {/* Retry options on failure */}
                    {!niprResult.success && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setNiprResult(null)
                            setNiprJobId(null)
                            setNiprProgress(0)
                            setNiprProgressMessage('')
                            // Trigger the automation again
                            setTimeout(() => runNiprAutomation(), 100)
                          }}
                          className="bg-black hover:bg-black/90 text-white"
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Retry Automation
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNiprResult(null)
                            setNiprMode('upload')
                          }}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload PDF Instead
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => goToStep(3)}
                        >
                          Skip for Now
                        </Button>
                      </div>
                    )}
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
                    onClick={() => goToStep(3)}
                    disabled={niprRunning || niprUploading}
                    className="h-12 px-6"
                  >
                    Skip for Now
                  </Button>
                  {niprMode === 'upload' ? (
                    <Button
                      type="button"
                      onClick={uploadNiprDocument}
                      disabled={niprUploading || !niprUploadFile}
                      className="h-12 px-6 bg-black hover:bg-black/90 text-white"
                    >
                      {niprUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload & Verify
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={runNiprAutomation}
                      disabled={niprRunning}
                      className="h-12 px-6 bg-black hover:bg-black/90 text-white"
                    >
                      {niprRunning ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 h-4 w-4" />
                          Run Auto-Retrieve
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Add Team Members */}
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
                  onClick={() => goToStep(1)}
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

