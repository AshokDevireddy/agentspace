/**
 * Onboarding-related mutation hooks for TanStack Query
 * Used by onboarding wizard for all mutation operations
 *
 * NOTE: Some mutations are re-exported from their canonical locations
 * to avoid duplication while maintaining the same API for onboarding components.
 */

import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useInvalidation } from '../useInvalidation'
import { RateLimitError } from '@/lib/error-utils'

// Re-export agent invite from the canonical location
export { useSendInvite as useInviteAgent } from './useAgentMutations'

// Re-export policy report mutations from the canonical location (these STAY as Next.js routes)
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
      try {
        return await apiClient.post<NiprRunResponse>('/api/nipr/run/', variables)
      } catch (error) {
        // Handle rate limit from apiClient's createErrorFromResponse
        if (error instanceof RateLimitError) {
          throw error
        }
        // Re-throw other errors
        throw error
      }
    },
    onSuccess: async (data, variables) => {
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

      const data = await apiClient.upload<NiprUploadResponse>('/api/nipr/upload/', formData)

      if (!data.success) {
        throw new Error(data.error || 'Failed to process NIPR document')
      }

      return data
    },
    onSuccess: async (data, file) => {
      await invalidateNiprRelated()
      options?.onSuccess?.(data, file)
    },
    onError: options?.onError,
  })
}
