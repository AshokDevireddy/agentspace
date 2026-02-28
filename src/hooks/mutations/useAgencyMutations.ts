/**
 * Agency-related mutation hooks
 * Handles agency settings updates including SMS templates via backend API
 */

import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useInvalidation } from '../useInvalidation'

// ============ Update Agency Settings (General) ============

interface UpdateAgencySettingsInput {
  agencyId: string
  data: Record<string, any>
}

interface UpdateAgencySettingsResponse {
  success: boolean
  message?: string
}

/**
 * General mutation hook for updating any agency settings
 */
export function useUpdateAgencySettings(options?: {
  onSuccess?: (data: UpdateAgencySettingsResponse, variables: UpdateAgencySettingsInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgencyRelated, invalidateConfigurationRelated } = useInvalidation()

  return useMutation<UpdateAgencySettingsResponse, Error, UpdateAgencySettingsInput>({
    mutationFn: async ({ agencyId, data }) => {
      const result = await apiClient.patch<{ message?: string }>(`/api/agencies/${agencyId}/settings/`, data)
      return { success: true, message: result.message }
    },
    onSuccess: async (data, variables) => {
      await Promise.all([
        invalidateAgencyRelated(variables.agencyId),
        invalidateConfigurationRelated(),
      ])
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

// ============ Update Agency SMS Enabled State ============

interface UpdateSmsEnabledInput {
  agencyId: string
  dbField: string
  enabled: boolean
}

interface UpdateSmsEnabledResponse {
  success: boolean
}

/**
 * Mutation hook for toggling SMS template enabled/disabled state
 */
export function useUpdateAgencySmsEnabled(options?: {
  onSuccess?: (data: UpdateSmsEnabledResponse, variables: UpdateSmsEnabledInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgencyRelated, invalidateConfigurationRelated } = useInvalidation()

  return useMutation<UpdateSmsEnabledResponse, Error, UpdateSmsEnabledInput>({
    mutationFn: async ({ agencyId, dbField, enabled }) => {
      await apiClient.patch(`/api/agencies/${agencyId}/settings/`, { [dbField]: enabled })
      return { success: true }
    },
    onSuccess: async (data, variables) => {
      await Promise.all([
        invalidateAgencyRelated(variables.agencyId),
        invalidateConfigurationRelated(),
      ])
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

// ============ Update Agency SMS Template ============

interface UpdateSmsTemplateInput {
  agencyId: string
  dbField: string
  template: string
}

interface UpdateSmsTemplateResponse {
  success: boolean
}

/**
 * Mutation hook for saving SMS template content
 */
export function useUpdateAgencySmsTemplate(options?: {
  onSuccess?: (data: UpdateSmsTemplateResponse, variables: UpdateSmsTemplateInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgencyRelated, invalidateConfigurationRelated } = useInvalidation()

  return useMutation<UpdateSmsTemplateResponse, Error, UpdateSmsTemplateInput>({
    mutationFn: async ({ agencyId, dbField, template }) => {
      await apiClient.patch(`/api/agencies/${agencyId}/settings/`, { [dbField]: template })
      return { success: true }
    },
    onSuccess: async (data, variables) => {
      await Promise.all([
        invalidateAgencyRelated(variables.agencyId),
        invalidateConfigurationRelated(),
      ])
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

// ============ Update Agency Primary Color ============

interface UpdateAgencyColorInput {
  agencyId: string
  primaryColor: string
}

interface UpdateAgencyColorResponse {
  success: boolean
}

/**
 * Mutation hook for updating agency primary color
 */
export function useUpdateAgencyColor(options?: {
  onSuccess?: (data: UpdateAgencyColorResponse, variables: UpdateAgencyColorInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgencyRelated } = useInvalidation()

  return useMutation<UpdateAgencyColorResponse, Error, UpdateAgencyColorInput>({
    mutationFn: async ({ agencyId, primaryColor }) => {
      await apiClient.patch(`/api/agencies/${agencyId}/settings/`, { primaryColor })
      return { success: true }
    },
    onSuccess: async (data, variables) => {
      await invalidateAgencyRelated(variables.agencyId)
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}

// ============ Upload Agency Logo ============

interface UploadAgencyLogoInput {
  agencyId: string
  file: File
}

interface UploadAgencyLogoResponse {
  success: boolean
  logoUrl: string
  message?: string
}

/**
 * Mutation hook for uploading agency logo
 */
export function useUploadAgencyLogo(options?: {
  onSuccess?: (data: UploadAgencyLogoResponse, variables: UploadAgencyLogoInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgencyRelated, invalidateConfigurationRelated } = useInvalidation()

  return useMutation<UploadAgencyLogoResponse, Error, UploadAgencyLogoInput>({
    mutationFn: async ({ agencyId, file }) => {
      const formData = new FormData()
      formData.append('file', file)

      return apiClient.upload<UploadAgencyLogoResponse>(`/api/agencies/${agencyId}/logo/`, formData)
    },
    onSuccess: async (data, variables) => {
      await Promise.all([
        invalidateAgencyRelated(variables.agencyId),
        invalidateConfigurationRelated(),
      ])
      options?.onSuccess?.(data, variables)
    },
    onError: options?.onError,
  })
}
