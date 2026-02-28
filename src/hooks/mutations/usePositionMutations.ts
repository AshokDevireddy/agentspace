/**
 * Position-related mutation hooks for TanStack Query
 * Used by configuration page for managing positions
 */

import { useApiMutation } from '../useMutations'
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
  isActive: boolean
}

interface Position {
  positionId: string
  name: string
  level: number
  description?: string
  isActive: boolean
  createdAt?: string
}

/**
 * Create a new position
 * Also invalidates agents as positions affect agent display
 */
export function useCreatePosition() {
  return useApiMutation<Position, CreatePositionInput>('/api/positions/', {
    method: 'POST',
    invalidateKeys: [
      queryKeys.configurationPositions(),
      queryKeys.positions,
      queryKeys.agents,
      queryKeys.agentsPendingPositions(),
    ],
  })
}

/**
 * Update an existing position
 * Also invalidates agents as position changes affect agent display
 */
export function useUpdatePosition() {
  return useApiMutation<Position, UpdatePositionInput & { positionId: string }>(
    (variables) => `/api/positions/${variables.positionId}/`,
    {
      method: 'PUT',
      invalidateKeys: [
        queryKeys.configurationPositions(),
        queryKeys.positions,
        queryKeys.agents,
        queryKeys.agentsPendingPositions(),
      ],
    }
  )
}

/**
 * Delete a position
 * Also invalidates agents as deleted positions affect agent display
 */
export function useDeletePosition() {
  return useApiMutation<void, { positionId: string }>(
    (variables) => `/api/positions/${variables.positionId}/`,
    {
      method: 'DELETE',
      invalidateKeys: [
        queryKeys.configurationPositions(),
        queryKeys.positions,
        queryKeys.agents,
        queryKeys.agentsPendingPositions(),
      ],
    }
  )
}
