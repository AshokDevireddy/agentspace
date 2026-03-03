/**
 * Policy report upload mutation hooks for TanStack Query
 * Used by configuration page and onboarding wizard for uploading policy reports
 *
 * All calls go directly to Django (no Next.js API route proxies).
 */

import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useInvalidation } from '../useInvalidation'

// Types
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
 * Create a policy report ingest job via Django
 */
export function useCreatePolicyReportJob(options?: {
  onSuccess?: (data: CreateJobResponse) => void
  onError?: (error: Error) => void
}) {
  const { invalidatePolicyReportRelated } = useInvalidation()

  return useMutation<CreateJobResponse, Error, CreateJobInput>({
    mutationFn: async (variables) => {
      return apiClient.post<CreateJobResponse>('/api/ingest/jobs/', variables)
    },
    onSuccess: async (data) => {
      await invalidatePolicyReportRelated()
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}

/**
 * Get signed URLs for uploading policy report files via Django
 */
export function useSignPolicyReportFiles(options?: {
  agencyId?: string
  onSuccess?: (data: SignFilesResponse) => void
  onError?: (error: Error) => void
}) {
  const { invalidatePolicyReportRelated } = useInvalidation()

  return useMutation<SignFilesResponse, Error, SignFilesInput>({
    mutationFn: async (variables) => {
      return apiClient.post<SignFilesResponse>('/api/ingest/presign/', variables, { skipCaseConversion: true })
    },
    onSuccess: async (data) => {
      await invalidatePolicyReportRelated(options?.agencyId)
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}
