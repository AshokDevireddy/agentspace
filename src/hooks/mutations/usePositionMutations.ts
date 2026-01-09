/**
 * Position-related mutation hooks for TanStack Query
 * Used by configuration page for managing positions
 */

import { useAuthenticatedMutation } from '../useMutations'
import { queryKeys } from '../queryKeys'

// Types
interface CreatePositionInput {
  name: string
  level: number
  description?: string | null
}

interface UpdatePositionInput {
  name: string
  level: number
  description?: string | null
  is_active: boolean
}

interface Position {
  position_id: string
  name: string
  level: number
  description?: string
  is_active: boolean
  created_at?: string
}

/**
 * Create a new position
 */
export function useCreatePosition() {
  return useAuthenticatedMutation<Position, CreatePositionInput>('/api/positions', {
    method: 'POST',
    invalidateKeys: [queryKeys.configurationPositions(), queryKeys.positions],
  })
}

/**
 * Update an existing position
 */
export function useUpdatePosition() {
  return useAuthenticatedMutation<Position, UpdatePositionInput & { positionId: string }>(
    (variables) => `/api/positions/${variables.positionId}`,
    {
      method: 'PUT',
      invalidateKeys: [queryKeys.configurationPositions(), queryKeys.positions],
    }
  )
}

/**
 * Delete a position
 */
export function useDeletePosition() {
  return useAuthenticatedMutation<void, { positionId: string }>(
    (variables) => `/api/positions/${variables.positionId}`,
    {
      method: 'DELETE',
      invalidateKeys: [queryKeys.configurationPositions(), queryKeys.positions],
    }
  )
}
