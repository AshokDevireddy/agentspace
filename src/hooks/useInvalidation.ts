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
   */
  const invalidateAgentRelated = useCallback(
    async (agentId?: string) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.agents }),
        queryClient.invalidateQueries({ queryKey: queryKeys.positions }),
        queryClient.invalidateQueries({ queryKey: queryKeys.search }),
      ]

      if (agentId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.agentDetail(agentId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.agentDownlines(agentId) })
        )
      }

      await Promise.all(invalidations)
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
      ]

      if (userId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(userId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.userAdminStatus(userId) })
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
   */
  const invalidateAgencyRelated = useCallback(
    async (agencyId?: string) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.agency }),
        queryClient.invalidateQueries({ queryKey: queryKeys.configuration }),
      ]

      if (agencyId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.agencyColor(agencyId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.agencyBranding(agencyId) })
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
      invalidateNiprRelated,
      invalidatePolicyReportRelated,
      invalidateAgencyRelated,
      invalidateCarrierRelated,
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
      invalidateNiprRelated,
      invalidatePolicyReportRelated,
      invalidateAgencyRelated,
      invalidateCarrierRelated,
      invalidateAll,
      queryClient,
    ]
  )
}
