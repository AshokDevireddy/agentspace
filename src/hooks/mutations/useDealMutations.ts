/**
 * Deal-related mutation hooks for TanStack Query
 * Used by PolicyDetailsModal for managing deals
 */

import { useAuthenticatedMutation } from '../useMutations'
import { queryKeys } from '../queryKeys'

interface DeleteDealInput {
  dealId: string
}

export function useDeleteDeal() {
  return useAuthenticatedMutation<void, DeleteDealInput>(
    (variables) => `/api/deals/${variables.dealId}`,
    {
      method: 'DELETE',
      invalidateKeys: [
        queryKeys.deals,
        queryKeys.conversations,
        queryKeys.clients,
      ],
      getInvalidateKeys: (variables) => [
        queryKeys.dealDetail(variables.dealId),
      ],
    }
  )
}
