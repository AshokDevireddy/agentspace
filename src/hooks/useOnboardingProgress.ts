/**
 * Onboarding Progress Hook
 *
 * Server-side state management for onboarding flow.
 * Replaces localStorage-based state with Django backend persistence.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

const API_BASE = process.env.NEXT_PUBLIC_DJANGO_API_URL || ''

interface OnboardingProgress {
  id: string
  user_id: string
  current_step: 'nipr_verification' | 'team_invitation' | 'completed'
  nipr_status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  nipr_job_id: string | null
  nipr_carriers: string[]
  nipr_licensed_states: {
    resident: string[]
    nonResident: string[]
  }
  pending_invitations: PendingInvitation[]
  started_at: string | null
  completed_at: string | null
  updated_at: string | null
}

interface PendingInvitation {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  permissionLevel: string
  uplineAgentId: string | null
  preInviteUserId?: string | null
}

interface UpdateProgressInput {
  step?: 'nipr_verification' | 'team_invitation' | 'completed'
  nipr_status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  nipr_job_id?: string
  nipr_carriers?: string[]
  nipr_licensed_states?: { resident: string[]; nonResident: string[] }
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || error.message || 'Request failed')
  }

  return response.json()
}

/**
 * Hook for managing onboarding progress state
 *
 * Uses Django backend for state persistence.
 */
export function useOnboardingProgress(userId?: string) {
  const queryClient = useQueryClient()

  // Query onboarding progress from server
  const {
    data: progress,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.onboardingProgress(userId),
    queryFn: () => fetchWithAuth(`${API_BASE}/api/onboarding/progress`),
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  })

  // Mutation to update progress
  const updateProgressMutation = useMutation({
    mutationFn: (input: UpdateProgressInput) =>
      fetchWithAuth(`${API_BASE}/api/onboarding/progress`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(userId) })
    },
  })

  // Mutation to complete onboarding
  const completeOnboardingMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth(`${API_BASE}/api/onboarding/complete`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(userId) })
    },
  })

  // Mutation to add pending invitation
  const addInvitationMutation = useMutation({
    mutationFn: (invitation: PendingInvitation) =>
      fetchWithAuth(`${API_BASE}/api/onboarding/invitations`, {
        method: 'POST',
        body: JSON.stringify(invitation),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingInvitations(userId) })
    },
  })

  // Mutation to remove pending invitation
  const removeInvitationMutation = useMutation({
    mutationFn: (index: number) =>
      fetchWithAuth(`${API_BASE}/api/onboarding/invitations/${index}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingInvitations(userId) })
    },
  })

  // Mutation to send all pending invitations
  const sendInvitationsMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth(`${API_BASE}/api/onboarding/invitations/send`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingInvitations(userId) })
    },
  })

  return {
    // Data
    progress: progress as OnboardingProgress | undefined,
    isLoading,
    error,

    // Actions
    refetch,
    updateProgress: updateProgressMutation.mutateAsync,
    completeOnboarding: completeOnboardingMutation.mutateAsync,
    addInvitation: addInvitationMutation.mutateAsync,
    removeInvitation: removeInvitationMutation.mutateAsync,
    sendInvitations: sendInvitationsMutation.mutateAsync,

    // Loading states
    isUpdating: updateProgressMutation.isPending,
    isCompleting: completeOnboardingMutation.isPending,
    isAddingInvitation: addInvitationMutation.isPending,
    isRemovingInvitation: removeInvitationMutation.isPending,
    isSendingInvitations: sendInvitationsMutation.isPending,
  }
}

export type { OnboardingProgress, PendingInvitation, UpdateProgressInput }
