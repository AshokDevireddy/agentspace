/**
 * Centralized subscription-related mutations
 * Handles Stripe checkout, subscription changes, and billing portal
 */

import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useInvalidation } from '../useInvalidation'

type SubscriptionTier = 'free' | 'basic' | 'pro' | 'expert'
type SubscriptionType = 'agent_subscription' | 'ai_mode_addon'

interface CheckoutSessionInput {
  priceId: string
  subscriptionType?: SubscriptionType
}

interface CheckoutSessionResponse {
  url: string
  sessionId?: string
}

interface ChangeSubscriptionInput {
  newTier: SubscriptionTier
}

interface ChangeSubscriptionResponse {
  success: boolean
  immediate: boolean
  effectiveDate?: string
}

interface AddSubscriptionItemInput {
  priceId: string
}

interface AddSubscriptionItemResponse {
  success: boolean
}

interface PortalSessionResponse {
  url: string
}

interface TopUpSessionInput {
  topupProductKey: string
}

interface TopUpSessionResponse {
  url: string
  sessionId?: string
}

/**
 * Hook for creating a Stripe checkout session
 */
export function useCreateCheckoutSession(options?: {
  onSuccess?: (url: string) => void
  onError?: (error: Error) => void
}) {
  const { invalidateSubscriptionRelated } = useInvalidation()

  return useMutation<CheckoutSessionResponse, Error, CheckoutSessionInput>({
    mutationFn: async ({ priceId, subscriptionType }) => {
      const data = await apiClient.post<CheckoutSessionResponse>('/api/stripe/create-checkout-session/', {
        priceId,
        subscriptionType,
        origin: window.location.origin,
      })

      if (!data.url) {
        throw new Error('No checkout URL returned')
      }

      return data
    },
    onSuccess: async (data) => {
      await invalidateSubscriptionRelated()
      options?.onSuccess?.(data.url)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for changing an existing subscription tier
 */
export function useChangeSubscription(options?: {
  onSuccess?: (response: ChangeSubscriptionResponse, newTier: SubscriptionTier) => void
  onError?: (error: Error) => void
}) {
  const { invalidateSubscriptionRelated } = useInvalidation()

  return useMutation<ChangeSubscriptionResponse, Error, ChangeSubscriptionInput>({
    mutationFn: async ({ newTier }) => {
      return apiClient.post<ChangeSubscriptionResponse>('/api/stripe/change-subscription/', { newTier })
    },
    onSuccess: async (data, variables) => {
      await invalidateSubscriptionRelated()
      options?.onSuccess?.(data, variables.newTier)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for adding a subscription item (e.g., AI Mode addon)
 */
export function useAddSubscriptionItem(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const { invalidateSubscriptionRelated } = useInvalidation()

  return useMutation<AddSubscriptionItemResponse, Error, AddSubscriptionItemInput>({
    mutationFn: async ({ priceId }) => {
      return apiClient.post<AddSubscriptionItemResponse>('/api/stripe/add-subscription-item/', { priceId })
    },
    onSuccess: async () => {
      await invalidateSubscriptionRelated()
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

/**
 * Hook for opening Stripe billing portal
 */
export function useOpenBillingPortal(options?: {
  onSuccess?: (url: string) => void
  onError?: (error: Error) => void
}) {
  const { invalidateSubscriptionRelated } = useInvalidation()

  return useMutation<PortalSessionResponse, Error, void>({
    mutationFn: async () => {
      return apiClient.post<PortalSessionResponse>('/api/stripe/create-portal-session/', {
        origin: window.location.origin,
      })
    },
    onSuccess: async (data) => {
      await invalidateSubscriptionRelated()
      options?.onSuccess?.(data.url)
    },
    onError: options?.onError,
  })
}

/**
 * Hook for creating a top-up purchase session
 */
export function useCreateTopUpSession(options?: {
  onSuccess?: (url: string) => void
  onError?: (error: Error) => void
}) {
  const { invalidateSubscriptionRelated } = useInvalidation()

  return useMutation<TopUpSessionResponse, Error, TopUpSessionInput>({
    mutationFn: async ({ topupProductKey }) => {
      const data = await apiClient.post<TopUpSessionResponse>('/api/stripe/create-topup-session/', {
        topupProductKey,
        origin: window.location.origin,
      })

      if (!data.url) {
        throw new Error('No checkout URL returned')
      }

      return data
    },
    onSuccess: async (data) => {
      await invalidateSubscriptionRelated()
      options?.onSuccess?.(data.url)
    },
    onError: options?.onError,
  })
}

/**
 * Input for combined subscription mutation
 */
interface SubscriptionMutationInput {
  tier: SubscriptionTier
  priceId: string
  hasActiveSubscription: boolean
  currentTier: SubscriptionTier
}

/**
 * Combined hook for subscription management
 * Handles both new subscriptions and upgrades/downgrades
 */
export function useSubscription(options?: {
  onCheckoutRedirect?: (url: string) => void
  onSubscriptionChanged?: (data: ChangeSubscriptionResponse, newTier: SubscriptionTier) => void
  onError?: (error: Error) => void
  mutationKey?: string
}) {
  const { invalidateSubscriptionRelated } = useInvalidation()

  return useMutation<
    { type: 'checkout' | 'change'; data: CheckoutSessionResponse | ChangeSubscriptionResponse },
    Error,
    SubscriptionMutationInput
  >({
    mutationKey: options?.mutationKey ? ['subscription', options.mutationKey] : undefined,
    mutationFn: async ({ tier, priceId, hasActiveSubscription, currentTier }) => {
      if (tier === 'free') {
        throw new Error('Cannot subscribe to free tier')
      }

      if (hasActiveSubscription && currentTier !== 'free') {
        const data = await apiClient.post<ChangeSubscriptionResponse>('/api/stripe/change-subscription/', { newTier: tier })
        return { type: 'change' as const, data }
      }

      const data = await apiClient.post<CheckoutSessionResponse>('/api/stripe/create-checkout-session/', {
        priceId,
        origin: window.location.origin,
      })

      if (!data.url) {
        throw new Error('No checkout URL returned')
      }

      return { type: 'checkout' as const, data }
    },
    onSuccess: async (result, variables) => {
      if (result.type === 'change') {
        await invalidateSubscriptionRelated()
        options?.onSubscriptionChanged?.(result.data as ChangeSubscriptionResponse, variables.tier)
      } else {
        options?.onCheckoutRedirect?.((result.data as CheckoutSessionResponse).url)
      }
    },
    onError: options?.onError,
  })
}
