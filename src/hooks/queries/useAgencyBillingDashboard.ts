/**
 * Query hook for agency billing dashboard data
 */

import { useApiFetch } from '../useApiFetch'
import { queryKeys } from '../queryKeys'

export interface AgencyBillingAgent {
  id: string
  firstName: string
  lastName: string
  email: string
  subscriptionTier: string
}

export interface AgencyBillingDashboard {
  enabled: boolean
  tier: string
  seatCount: number
  perSeatCost: number
  totalMonthlyCost: number
  billingCycleEnd: string | null
  scheduledTierChange: string | null
  scheduledTierChangeDate: string | null
  agents: AgencyBillingAgent[]
}

export function useAgencyBillingDashboard(enabled = true) {
  return useApiFetch<AgencyBillingDashboard>(
    queryKeys.agencyBillingDashboard(),
    '/api/stripe/agency-billing/dashboard/',
    {
      enabled,
      staleTime: 60 * 1000, // 1 minute
    },
  )
}
