/**
 * Policy report upload mutation hooks for TanStack Query
 * Used by configuration page and onboarding wizard for uploading policy reports
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../queryKeys'

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
 * Create a policy report ingest job
 */
export function useCreatePolicyReportJob() {
  return useMutation<CreateJobResponse, Error, CreateJobInput>({
    mutationFn: async (variables) => {
      const response = await fetch('/api/upload-policy-reports/create-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
 * Get signed URLs for uploading policy report files
 */
export function useSignPolicyReportFiles() {
  const queryClient = useQueryClient()

  return useMutation<SignFilesResponse, Error, SignFilesInput>({
    mutationFn: async (variables) => {
      const response = await fetch('/api/upload-policy-reports/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(variables),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to get upload URLs')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate policy files query after successful upload
      queryClient.invalidateQueries({ queryKey: queryKeys.configurationPolicyFiles() })
    },
  })
}
