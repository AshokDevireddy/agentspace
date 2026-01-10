/**
 * Agency-related mutation hooks
 * Handles agency settings updates including SMS templates
 */

import { useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useInvalidation } from '../useInvalidation'

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
      const supabase = createClient()
      const { error } = await supabase
        .from('agencies')
        .update({ [dbField]: enabled })
        .eq('id', agencyId)

      if (error) {
        throw new Error(error.message)
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
      const supabase = createClient()
      const { error } = await supabase
        .from('agencies')
        .update({ [dbField]: template })
        .eq('id', agencyId)

      if (error) {
        throw new Error(error.message)
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
      const supabase = createClient()
      const { error } = await supabase
        .from('agencies')
        .update({ primary_color: primaryColor })
        .eq('id', agencyId)

      if (error) {
        throw new Error(error.message)
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
