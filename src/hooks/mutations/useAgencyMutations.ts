/**
 * Agency-related mutation hooks
 * Handles agency settings updates including SMS templates via Django API
 */

import { useMutation } from '@tanstack/react-query'
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
 * General mutation hook for updating any agency settings via Django API
 */
export function useUpdateAgencySettings(options?: {
  onSuccess?: (data: UpdateAgencySettingsResponse, variables: UpdateAgencySettingsInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgencyRelated, invalidateConfigurationRelated } = useInvalidation()

  return useMutation<UpdateAgencySettingsResponse, Error, UpdateAgencySettingsInput>({
    mutationFn: async ({ agencyId, data }) => {
      const response = await fetch(`/api/agencies/${agencyId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to update agency settings')
      }

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
      const response = await fetch(`/api/agencies/${agencyId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [dbField]: enabled }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to update SMS setting')
      }

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
      const response = await fetch(`/api/agencies/${agencyId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [dbField]: template }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to update SMS template')
      }

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
 * Used when theme changes to update the default color
 */
export function useUpdateAgencyColor(options?: {
  onSuccess?: (data: UpdateAgencyColorResponse, variables: UpdateAgencyColorInput) => void
  onError?: (error: Error) => void
}) {
  const { invalidateAgencyRelated } = useInvalidation()

  return useMutation<UpdateAgencyColorResponse, Error, UpdateAgencyColorInput>({
    mutationFn: async ({ agencyId, primaryColor }) => {
      const response = await fetch(`/api/agencies/${agencyId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ primaryColor }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to update primary color')
      }

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

      const response = await fetch(`/api/agencies/${agencyId}/logo`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to upload logo')
      }

      return result
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
