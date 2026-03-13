/**
 * Mutation hooks for agency-level billing management
 */

import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useInvalidation } from '../useInvalidation'

interface EnableAgencyBillingInput {
  tier: 'basic' | 'pro' | 'expert'
}

interface EnableAgencyBillingResponse {
  url: string
  sessionId?: string
}

interface ChangeAgencyTierInput {
  newTier: 'basic' | 'pro' | 'expert'
}

interface ChangeAgencyTierResponse {
  success: boolean
  status: string
  newTier: string
  effectiveDate?: string
}

interface PortalResponse {
  url: string
}

interface DisableResponse {
  success: boolean
  message: string
}

export function useEnableAgencyBilling(options?: {
  onSuccess?: (url: string) => void
  onError?: (error: Error) => void
}) {
  return useMutation<EnableAgencyBillingResponse, Error, EnableAgencyBillingInput>({
    mutationFn: async ({ tier }) => {
      return apiClient.post<EnableAgencyBillingResponse>('/api/stripe/agency-billing/enable/', {
        tier,
        origin: window.location.origin,
      })
    },
    onSuccess: (data) => {
      options?.onSuccess?.(data.url)
    },
    onError: options?.onError,
  })
}

export function useDisableAgencyBilling(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const { invalidateSubscriptionRelated } = useInvalidation()

  return useMutation<DisableResponse, Error, void>({
    mutationFn: async () => {
      return apiClient.post<DisableResponse>('/api/stripe/agency-billing/disable/', {})
    },
    onSuccess: async () => {
      await invalidateSubscriptionRelated()
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

export function useChangeAgencyTier(options?: {
  onSuccess?: (response: ChangeAgencyTierResponse) => void
  onError?: (error: Error) => void
}) {
  const { invalidateSubscriptionRelated } = useInvalidation()

  return useMutation<ChangeAgencyTierResponse, Error, ChangeAgencyTierInput>({
    mutationFn: async ({ newTier }) => {
      return apiClient.post<ChangeAgencyTierResponse>('/api/stripe/agency-billing/change-tier/', {
        newTier,
      })
    },
    onSuccess: async (data) => {
      await invalidateSubscriptionRelated()
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}

export function useAgencyBillingPortal(options?: {
  onSuccess?: (url: string) => void
  onError?: (error: Error) => void
}) {
  return useMutation<PortalResponse, Error, void>({
    mutationFn: async () => {
      return apiClient.post<PortalResponse>('/api/stripe/agency-billing/portal/', {
        origin: window.location.origin,
      })
    },
    onSuccess: (data) => {
      options?.onSuccess?.(data.url)
    },
    onError: options?.onError,
  })
}
