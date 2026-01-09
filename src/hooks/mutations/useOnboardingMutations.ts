/**
 * Onboarding-related mutation hooks for TanStack Query
 * Used by onboarding wizard for all mutation operations
 *
 * NOTE: Some mutations are re-exported from their canonical locations
 * to avoid duplication while maintaining the same API for onboarding components.
 */

import { useMutation } from '@tanstack/react-query'

// Re-export agent invite from the canonical location
// The hook name is different but the functionality is the same
export { useSendInvite as useInviteAgent } from './useAgentMutations'

// Re-export policy report mutations from the canonical location
export { useCreatePolicyReportJob as useCreateOnboardingPolicyJob } from './usePolicyReportMutations'
export { useSignPolicyReportFiles as useSignOnboardingPolicyFiles } from './usePolicyReportMutations'

// Re-export carrier login from the canonical location
export { useSaveCarrierLogin as useOnboardingCarrierLogin } from './useCarrierMutations'

// ============ NIPR Mutations ============

interface NiprRunInput {
  lastName: string
  npn: string
  ssn: string
  dob: string
}

interface NiprRunResponse {
  success?: boolean
  queued?: boolean
  processing?: boolean
  jobId?: string
  position?: number
  status?: string
  error?: string
  retryAfter?: number
  analysis?: {
    success: boolean
    carriers: string[]
    unique_carriers?: string[]
    licensedStates: { resident: string[]; nonResident: string[] }
    analyzedAt: string
  }
}

/**
 * Run NIPR automation verification
 */
export function useRunNiprAutomation() {
  return useMutation<NiprRunResponse, Error, NiprRunInput>({
    mutationFn: async (variables) => {
      const response = await fetch('/api/nipr/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variables),
      })

      const data = await response.json()

      // Handle rate limit specially - don't throw, let caller handle
      if (response.status === 429) {
        return { ...data, error: 'rate_limit', retryAfter: data.retryAfter }
      }

      // Handle conflict (already has pending job) - don't throw, let caller handle
      if (response.status === 409) {
        return { ...data, status: 'conflict' }
      }

      // For other errors, throw
      if (!response.ok && !data.queued && !data.processing) {
        throw new Error(data.error || 'NIPR verification failed')
      }

      return data
    },
  })
}

/**
 * Upload NIPR document for verification
 */
export function useUploadNiprDocument() {
  return useMutation<
    {
      success: boolean
      error?: string
      analysis?: {
        carriers: string[]
        licensedStates: { resident: string[]; nonResident: string[] }
        analyzedAt: string
      }
    },
    Error,
    File
  >({
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/nipr/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process NIPR document')
      }

      return data
    },
  })
}

// ============ Policy Report Upload Mutations ============

interface CreateJobInput {
  agencyId: string
  expectedFiles: number
  clientJobId: string
}

interface CreateJobResponse {
  job: {
    jobId: string
  }
}

interface SignFilesInput {
  jobId: string
  files: Array<{
    fileName: string
    contentType: string
    size: number
  }>
}

interface SignedFile {
  fileId: string
  fileName: string
  presignedUrl: string
}

interface SignFilesResponse {
  files: SignedFile[]
}

/**
 * Create a policy report ingest job (onboarding context)
 */
export function useCreateOnboardingPolicyJob() {
  return useMutation<CreateJobResponse, Error, CreateJobInput>({
    mutationFn: async (variables) => {
      const response = await fetch('/api/upload-policy-reports/create-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variables),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create ingest job')
      }

      return response.json()
    },
  })
}

/**
 * Get signed URLs for uploading policy report files (onboarding context)
 */
export function useSignOnboardingPolicyFiles() {
  return useMutation<SignFilesResponse, Error, SignFilesInput>({
    mutationFn: async (variables) => {
      const response = await fetch('/api/upload-policy-reports/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variables),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to get upload URLs')
      }

      return response.json()
    },
  })
}

// ============ Carrier Login Mutation (Onboarding) ============

/**
 * Save carrier login credentials (onboarding context - uses authenticated mutation)
 */
export function useOnboardingCarrierLogin() {
  return useAuthenticatedMutation<
    { success: boolean },
    { carrier_name: string; login: string; password: string }
  >('/api/carrier-logins', {
    method: 'POST',
  })
}
