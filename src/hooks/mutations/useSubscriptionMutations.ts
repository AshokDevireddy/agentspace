/**
 * Centralized subscription-related mutations
 * Handles Stripe checkout, subscription changes, and billing portal
 */

import { useMutation } from '@tanstack/react-query'
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
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId, subscriptionType }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      if (!data.url) {
        throw new Error('No checkout URL returned')
      }

      return data
    },
    onSuccess: async (data) => {
      // Invalidate subscription data in case user returns from checkout
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
      const response = await fetch('/api/stripe/change-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newTier }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change subscription')
      }

      return data
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
      const response = await fetch('/api/stripe/add-subscription-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add subscription item')
      }

      return data
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
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal')
      }

      return data
    },
    onSuccess: async (data) => {
      // Invalidate subscription data in case user makes changes in portal
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
      const response = await fetch('/api/stripe/create-topup-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ topupProductKey }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create top-up session')
      }

      if (!data.url) {
        throw new Error('No checkout URL returned')
      }

      return data
    },
    onSuccess: async (data) => {
      // Invalidate subscription data in case user completes top-up purchase
      await invalidateSubscriptionRelated()
      options?.onSuccess?.(data.url)
    },
    onError: options?.onError,
  })
}

/**
 * Combined hook for subscription management
 * Handles both new subscriptions and upgrades/downgrades
 */
export function useSubscription(options?: {
  hasActiveSubscription: boolean
  currentTier: SubscriptionTier
  onCheckoutRedirect?: (url: string) => void
  onSubscriptionChanged?: (data: ChangeSubscriptionResponse, newTier: SubscriptionTier) => void
  onError?: (error: Error) => void
}) {
  const { invalidateSubscriptionRelated } = useInvalidation()

  return useMutation<
    { type: 'checkout' | 'change'; data: CheckoutSessionResponse | ChangeSubscriptionResponse },
    Error,
    { tier: SubscriptionTier; priceId: string }
  >({
    mutationFn: async ({ tier, priceId }) => {
      if (tier === 'free') {
        throw new Error('Cannot subscribe to free tier')
      }

      // If user already has an active subscription, change it
      if (options?.hasActiveSubscription && options?.currentTier !== 'free') {
        const response = await fetch('/api/stripe/change-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ newTier: tier }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to change subscription')
        }

        return { type: 'change' as const, data }
      }

      // Create new subscription
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

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
