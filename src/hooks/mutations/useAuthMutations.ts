/**
 * Authentication-related mutation hooks for TanStack Query
 * Used by auth pages (register, reset-password, onboarding)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../queryKeys'

// ============ Register Mutation ============

interface RegisterInput {
  email: string
  password: string
  firstName: string
  lastName: string
  phoneNumber: string
  inviteCode?: string
}

interface RegisterResponse {
  success: boolean
  user?: {
    id: string
    email: string
  }
  error?: string
}

/**
 * Register a new user
 */
export function useRegister() {
  return useMutation<RegisterResponse, Error, RegisterInput>({
    mutationFn: async (input) => {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      return data
    },
  })
}

// ============ Reset Password Mutation ============

interface ResetPasswordInput {
  email: string
}

interface ResetPasswordResponse {
  success: boolean
  message?: string
  error?: string
}

/**
 * Request password reset email
 */
export function useResetPassword() {
  return useMutation<ResetPasswordResponse, Error, ResetPasswordInput>({
    mutationFn: async (input) => {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      return data
    },
  })
}

// ============ Complete Onboarding Mutation ============

interface CompleteOnboardingResponse {
  success: boolean
}

/**
 * Mark user onboarding as complete
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient()

  return useMutation<CompleteOnboardingResponse, Error, void>({
    mutationFn: async () => {
      const response = await fetch('/api/user/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete onboarding')
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() })
    },
  })
}
