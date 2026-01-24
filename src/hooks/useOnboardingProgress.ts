/**
 * Onboarding Progress Hook
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getOnboardingEndpoint } from '@/lib/api-config'
import { STALE_TIMES } from '@/lib/query-config'
import { queryKeys } from './queryKeys'

// ============ Types ============

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

// ============ Helpers ============

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

// ============ Hook ============

export function useOnboardingProgress(userId?: string) {
  const queryClient = useQueryClient()

  const {
    data: progress,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.onboardingProgress(userId),
    queryFn: () => fetchWithAuth(getOnboardingEndpoint('progress')),
    enabled: !!userId,
    staleTime: STALE_TIMES.fast,
    retry: 2,
  })

  const updateProgressMutation = useMutation({
    mutationFn: (input: UpdateProgressInput) =>
      fetchWithAuth(getOnboardingEndpoint('progress'), {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(userId) })
    },
  })

  const completeOnboardingMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth(getOnboardingEndpoint('complete'), {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(userId) })
    },
  })

  const addInvitationMutation = useMutation({
    mutationFn: (invitation: PendingInvitation) =>
      fetchWithAuth(getOnboardingEndpoint('invitations'), {
        method: 'POST',
        body: JSON.stringify(invitation),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingInvitations(userId) })
    },
  })

  const removeInvitationMutation = useMutation({
    mutationFn: (index: number) =>
      fetchWithAuth(getOnboardingEndpoint('invitationDelete', index), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingInvitations(userId) })
    },
  })

  const sendInvitationsMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth(getOnboardingEndpoint('invitationsSend'), {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingInvitations(userId) })
    },
  })

  return {
    progress: progress as OnboardingProgress | undefined,
    isLoading,
    error,

    refetch,
    updateProgress: updateProgressMutation.mutateAsync,
    completeOnboarding: completeOnboardingMutation.mutateAsync,
    addInvitation: addInvitationMutation.mutateAsync,
    removeInvitation: removeInvitationMutation.mutateAsync,
    sendInvitations: sendInvitationsMutation.mutateAsync,

    isUpdating: updateProgressMutation.isPending,
    isCompleting: completeOnboardingMutation.isPending,
    isAddingInvitation: addInvitationMutation.isPending,
    isRemovingInvitation: removeInvitationMutation.isPending,
    isSendingInvitations: sendInvitationsMutation.isPending,
  }
}

export type { OnboardingProgress, PendingInvitation, UpdateProgressInput }
