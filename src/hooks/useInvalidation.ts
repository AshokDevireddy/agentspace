/**
 * Centralized cache invalidation helper for TanStack Query
 * Provides logical groupings for related query invalidations
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { queryKeys } from './queryKeys'

/**
 * Hook for centralized cache invalidation
 * Groups related queries for atomic invalidation operations
 */
export function useInvalidation() {
  const queryClient = useQueryClient()

  /**
   * Invalidate all agent-related queries
   * Uses predicate-based invalidation for downlines to handle hierarchy changes
   * (when upline changes, both old and new upline's downlines need refresh)
   */
  const invalidateAgentRelated = useCallback(
    async (agentId?: string, options?: { invalidateAllDownlines?: boolean }) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.agents }),
        queryClient.invalidateQueries({ queryKey: queryKeys.positions }),
        queryClient.invalidateQueries({ queryKey: queryKeys.search }),
        // Invalidate all downline queries to handle hierarchy changes correctly
        // This ensures old and new uplines' downline caches are refreshed
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey
            return Array.isArray(key) && key[0] === 'agents' && key[1] === 'downlines'
          },
        }),
      ]

      if (agentId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.agentDetail(agentId) })
        )
      }

      await Promise.all(invalidations)

      // Then trigger refetch of active queries (don't await - let it happen in background)
      // This prevents blocking the mutation callback while still triggering immediate updates
      queryClient.refetchQueries({ queryKey: queryKeys.agents, type: 'active' }).catch(err => {
        console.error('[Invalidation] Failed to refetch agents:', err)
      })
    },
    [queryClient]
  )

  /**
   * Invalidate all deal/policy-related queries
   * Also invalidates conversations since deals drive conversations
   */
  const invalidateDealRelated = useCallback(
    async (dealId?: string) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.deals }),
        queryClient.invalidateQueries({ queryKey: queryKeys.policies }),
        queryClient.invalidateQueries({ queryKey: queryKeys.expectedPayouts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics }),
        // Deals drive conversations - invalidate all conversation lists
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey
            return Array.isArray(key) && key[0] === 'conversations'
          },
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.drafts }),
      ]

      if (dealId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.dealDetail(dealId) })
        )
      }

      await Promise.all(invalidations)
    },
    [queryClient]
  )

  /**
   * Invalidate all conversation/message-related queries
   * Uses predicate-based invalidation to catch all filter variations
   */
  const invalidateConversationRelated = useCallback(
    async (conversationId?: string) => {
      const invalidations = [
        // Use predicate to invalidate all conversation lists regardless of filters
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey
            return Array.isArray(key) && key[0] === 'conversations'
          },
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.drafts }),
      ]

      if (conversationId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.conversationDetail(conversationId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) })
        )
      }

      await Promise.all(invalidations)
    },
    [queryClient]
  )

  /**
   * Invalidate all client-related queries
   */
  const invalidateClientRelated = useCallback(
    async (clientId?: string) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.clients }),
        queryClient.invalidateQueries({ queryKey: queryKeys.search }),
      ]

      if (clientId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.clientDetail(clientId) })
        )
      }

      await Promise.all(invalidations)
    },
    [queryClient]
  )

  /**
   * Invalidate all user/profile-related queries
   */
  const invalidateUserRelated = useCallback(
    async (userId?: string) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.user }),
        queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.subscription }),
        // Invalidate all userById queries using predicate
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey
            return Array.isArray(key) && key[0] === 'user' && key[1] === 'by-id'
          },
        }),
      ]

      if (userId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(userId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.userAdminStatus(userId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.userById(userId) })
        )
      }

      await Promise.all(invalidations)
    },
    [queryClient]
  )

  /**
   * Invalidate all subscription/billing-related queries
   */
  const invalidateSubscriptionRelated = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription }),
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptionStatus() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.user }),
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() }),
    ])
  }, [queryClient])

  /**
   * Invalidate all configuration-related queries
   */
  const invalidateConfigurationRelated = useCallback(
    async (tab?: string) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.configuration }),
      ]

      if (tab) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.configurationTab(tab) })
        )
      }

      await Promise.all(invalidations)
    },
    [queryClient]
  )

  /**
   * Invalidate all product-related queries
   * Includes commission configs since products drive commission structures
   */
  const invalidateProductRelated = useCallback(
    async (carrierId?: string) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.products }),
        queryClient.invalidateQueries({ queryKey: queryKeys.configurationProducts() }),
        // Products drive commission structures - invalidate all commission queries
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey
            return Array.isArray(key) && key[0] === 'configuration' && key[1] === 'commissions'
          },
        }),
      ]

      if (carrierId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.configurationCommissions(carrierId) })
        )
      }

      await Promise.all(invalidations)
    },
    [queryClient]
  )

  /**
   * Invalidate all position-related queries
   * Also invalidates agents since positions affect agent hierarchy
   */
  const invalidatePositionRelated = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.positions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.configurationPositions() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.agents }),
      // Positions affect commission structures
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          return Array.isArray(key) && key[0] === 'configuration' && key[1] === 'commissions'
        },
      }),
    ])
  }, [queryClient])

  /**
   * Invalidate all NIPR-related queries
   */
  const invalidateNiprRelated = useCallback(
    async (userId?: string) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.nipr }),
        queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() }),
      ]

      if (userId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.niprStatus(userId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(userId) })
        )
      }

      await Promise.all(invalidations)
    },
    [queryClient]
  )

  /**
   * Invalidate all policy report-related queries
   */
  const invalidatePolicyReportRelated = useCallback(
    async (agencyId?: string) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.policyReports }),
        queryClient.invalidateQueries({ queryKey: queryKeys.configurationPolicyFiles() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deals }),
      ]

      if (agencyId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.policyReportsFiles(agencyId) })
        )
      }

      await Promise.all(invalidations)
    },
    [queryClient]
  )

  /**
   * Invalidate all agency-related queries
   * Includes domain-based branding for white-label scenarios
   */
  const invalidateAgencyRelated = useCallback(
    async (agencyId?: string) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.agency }),
        queryClient.invalidateQueries({ queryKey: queryKeys.configuration }),
        // Invalidate all domain-based branding queries (for white-label)
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey
            return Array.isArray(key) && key[0] === 'agency' && key[1] === 'branding-by-domain'
          },
        }),
      ]

      if (agencyId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.agencyColor(agencyId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.agencyBranding(agencyId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.agencyScoreboardSettings(agencyId) })
        )
      }

      await Promise.all(invalidations)
    },
    [queryClient]
  )

  /**
   * Invalidate all carrier-related queries
   */
  const invalidateCarrierRelated = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.carriers }),
      queryClient.invalidateQueries({ queryKey: queryKeys.configurationCarriers() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.configurationCarrierNames() }),
    ])
  }, [queryClient])

  /**
   * Invalidate all onboarding-related queries
   */
  const invalidateOnboardingRelated = useCallback(
    async (userId?: string) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.onboarding }),
        queryClient.invalidateQueries({ queryKey: queryKeys.nipr }),
        queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() }),
      ]

      if (userId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(userId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.onboardingInvitations(userId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.niprStatus(userId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(userId) })
        )
      }

      await Promise.all(invalidations)
    },
    [queryClient]
  )

  /**
   * Invalidate all queries (nuclear option - use sparingly)
   */
  const invalidateAll = useCallback(async () => {
    await queryClient.invalidateQueries()
  }, [queryClient])

  return useMemo(
    () => ({
      invalidateAgentRelated,
      invalidateDealRelated,
      invalidateConversationRelated,
      invalidateClientRelated,
      invalidateUserRelated,
      invalidateSubscriptionRelated,
      invalidateConfigurationRelated,
      invalidateProductRelated,
      invalidatePositionRelated,
      invalidateNiprRelated,
      invalidatePolicyReportRelated,
      invalidateAgencyRelated,
      invalidateCarrierRelated,
      invalidateOnboardingRelated,
      invalidateAll,
      // Expose queryClient for direct access when needed
      queryClient,
    }),
    [
      invalidateAgentRelated,
      invalidateDealRelated,
      invalidateConversationRelated,
      invalidateClientRelated,
      invalidateUserRelated,
      invalidateSubscriptionRelated,
      invalidateConfigurationRelated,
      invalidateProductRelated,
      invalidatePositionRelated,
      invalidateNiprRelated,
      invalidatePolicyReportRelated,
      invalidateAgencyRelated,
      invalidateCarrierRelated,
      invalidateOnboardingRelated,
      invalidateAll,
      queryClient,
    ]
  )
}
