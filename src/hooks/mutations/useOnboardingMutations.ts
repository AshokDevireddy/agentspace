/**
 * Onboarding-related mutation hooks for TanStack Query
 * Used by onboarding wizard for all mutation operations
 *
 * NOTE: Some mutations are re-exported from their canonical locations
 * to avoid duplication while maintaining the same API for onboarding components.
 */

import { useMutation } from '@tanstack/react-query'
import { useInvalidation } from '../useInvalidation'
import { RateLimitError } from '@/lib/error-utils'

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
    uniqueCarriers?: string[]
    licensedStates: { resident: string[]; nonResident: string[] }
    analyzedAt: string
  }
}

/**
 * Run NIPR automation verification
 */
export function useRunNiprAutomation(options?: {
  onSuccess?: (data: NiprRunResponse, variables: NiprRunInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateNiprRelated } = useInvalidation()

  return useMutation<NiprRunResponse, Error, NiprRunInput>({
    mutationFn: async (variables) => {
      const response = await fetch('/api/nipr/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(variables),
      })

      const data = await response.json()

      // Handle rate limit properly - throw error for onError handling
      if (response.status === 429) {
        throw new RateLimitError(
          'Rate limit exceeded for NIPR verification',
          data.retryAfter || 60
        )
      }

      // Handle conflict (already has pending job) - return as success to allow polling
      if (response.status === 409) {
        return { ...data, status: 'conflict' }
      }

      // For other errors, throw
      if (!response.ok && !data.queued && !data.processing) {
        throw new Error(data.error || 'NIPR verification failed')
      }

      return data
    },
    onSuccess: async (data, variables) => {
      // Use centralized invalidation - handles NIPR queries and user profile
      await invalidateNiprRelated()
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

interface NiprUploadResponse {
  success: boolean
  error?: string
  analysis?: {
    carriers: string[]
    licensedStates: { resident: string[]; nonResident: string[] }
    analyzedAt: string
  }
}

/**
 * Upload NIPR document for verification
 */
export function useUploadNiprDocument(options?: {
  onSuccess?: (data: NiprUploadResponse, file: File) => void
  onError?: (error: Error) => void
}) {
  const { invalidateNiprRelated } = useInvalidation()

  return useMutation<NiprUploadResponse, Error, File>({
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
    onSuccess: async (data, file) => {
      // Use centralized invalidation - handles NIPR queries and user profile
      await invalidateNiprRelated()
      options?.onSuccess?.(data, file)
    },
    onError: options?.onError,
  })
}

// NOTE: Policy report mutations (useCreateOnboardingPolicyJob, useSignOnboardingPolicyFiles)
// are re-exported from ./usePolicyReportMutations at the top of this file
// to avoid duplication while maintaining the same API for onboarding components.
//
// NOTE: useOnboardingCarrierLogin is re-exported from ./useCarrierMutations at the top of this file
