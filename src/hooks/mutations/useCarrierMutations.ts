/**
 * Carrier-related mutation hooks for TanStack Query
 * Used by configuration page for managing carriers
 */

import { useAuthenticatedMutation } from '../useMutations'
import { queryKeys } from '../queryKeys'

// Types
interface Carrier {
  id: string
  name: string
  display_name: string
  is_active: boolean
  created_at?: string
}

/**
 * Fetch carriers (used to refresh carrier list after product changes)
 * Note: This returns carriers as a side effect of a GET request
 */
export function useRefreshCarriers() {
  return useAuthenticatedMutation<Carrier[], void>('/api/carriers', {
    method: 'GET',
    invalidateKeys: [queryKeys.configurationCarriers(), queryKeys.carriers],
  })
}

// Carrier login types
interface SaveCarrierLoginInput {
  carrier_name: string
  login: string
  password: string
}

interface CarrierLoginResponse {
  success: boolean
}

/**
 * Save carrier login credentials
 */
export function useSaveCarrierLogin() {
  return useAuthenticatedMutation<CarrierLoginResponse, SaveCarrierLoginInput>('/api/carrier-logins', {
    method: 'POST',
    // No invalidation needed as this doesn't affect cached data
  })
}
