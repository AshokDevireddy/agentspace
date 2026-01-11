/**
 * Authentication-related mutation hooks for TanStack Query
 * Used by auth pages (register, reset-password, onboarding, login, setup-account)
 */

import { useMutation } from '@tanstack/react-query'
import { useInvalidation } from '../useInvalidation'
import { supabaseRestFetch, updatePassword } from '@/lib/supabase/api'

// ============ Register Mutation ============

interface RegisterInput {
  email: string
  firstName: string
  lastName: string
  phoneNumber: string
  agencyName?: string
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
export function useRegister(options?: {
  onSuccess?: (data: RegisterResponse) => void
  onError?: (error: Error) => void
}) {
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
    onSuccess: options?.onSuccess,
    onError: options?.onError,
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
export function useResetPassword(options?: {
  onSuccess?: (data: ResetPasswordResponse) => void
  onError?: (error: Error) => void
}) {
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
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}

// ============ Complete Onboarding Mutation ============

interface CompleteOnboardingResponse {
  success: boolean
}

/**
 * Mark user onboarding as complete
 */
export function useCompleteOnboarding(options?: {
  onSuccess?: (data: CompleteOnboardingResponse) => void
  onError?: (error: Error) => void
}) {
  const { invalidateUserRelated } = useInvalidation()

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
    onSuccess: async (data) => {
      await invalidateUserRelated()
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}

// ============ Sign In Mutation ============

interface SignInInput {
  email: string
  password: string
}

interface SignInUserData {
  id: string
  role: string
  status: string
  agency_id: string
}

interface SignInAgencyData {
  whitelabel_domain: string | null
}

interface SignInResponse {
  user: SignInUserData
  agency: SignInAgencyData
}

/**
 * Sign in user with email and password using native Supabase client
 * This properly establishes the session for both API routes AND RPC calls
 */
export function useSignIn(options?: {
  onSuccess?: (data: SignInResponse) => void
  onError?: (error: Error) => void
}) {
  return useMutation<SignInResponse, Error, SignInInput>({
    mutationFn: async ({ email, password }) => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Invalid login credentials')
      }

      const authUserId = authData.user.id

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, status, agency_id')
        .eq('auth_user_id', authUserId)
        .single()

      if (userError || !userData) {
        throw new Error('User profile not found')
      }

      const { data: agencyData, error: agencyError } = await supabase
        .from('agencies')
        .select('whitelabel_domain')
        .eq('id', userData.agency_id)
        .single()

      if (agencyError || !agencyData) {
        throw new Error('Agency not found')
      }

      return {
        user: userData as SignInUserData,
        agency: agencyData as SignInAgencyData,
      }
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}

// ============ Update Password Mutation ============

interface UpdatePasswordInput {
  accessToken: string
  newPassword: string
}

interface UpdatePasswordResponse {
  success: boolean
}

/**
 * Update user password using access token
 * Used by forgot-password and setup-account pages
 */
export function useUpdatePassword(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  return useMutation<UpdatePasswordResponse, Error, UpdatePasswordInput>({
    mutationFn: async ({ accessToken, newPassword }) => {
      const result = await updatePassword(accessToken, newPassword)

      if (!result.success) {
        throw new Error(result.error || 'Failed to update password')
      }

      return { success: true }
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}

// ============ Update User Profile Mutation ============

interface UpdateUserProfileInput {
  userId: string
  accessToken: string
  data: {
    first_name?: string
    last_name?: string
    phone_number?: string
    status?: string
  }
}

interface UpdateUserProfileResponse {
  success: boolean
}

/**
 * Update user profile data
 * Used by setup-account page for profile updates
 */
export function useUpdateUserProfile(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const { invalidateUserRelated } = useInvalidation()

  return useMutation<UpdateUserProfileResponse, Error, UpdateUserProfileInput>({
    mutationFn: async ({ userId, accessToken, data }) => {
      const { error } = await supabaseRestFetch(
        `/rest/v1/users?id=eq.${userId}`,
        {
          accessToken,
          method: 'PATCH',
          body: {
            ...data,
            updated_at: new Date().toISOString(),
          },
        }
      )

      if (error) {
        throw new Error(error || 'Failed to update profile')
      }

      return { success: true }
    },
    onSuccess: async () => {
      await invalidateUserRelated()
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

// ============ Update User Status Mutation ============

interface UpdateUserStatusInput {
  userId: string
  accessToken: string
  status: string
}

interface UpdateUserStatusResponse {
  success: boolean
}

/**
 * Update user status
 * Used by auth/confirm page for status updates during email confirmation
 */
export function useUpdateUserStatus(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const { invalidateUserRelated } = useInvalidation()

  return useMutation<UpdateUserStatusResponse, Error, UpdateUserStatusInput>({
    mutationFn: async ({ userId, accessToken, status }) => {
      const { error } = await supabaseRestFetch(
        `/rest/v1/users?id=eq.${userId}`,
        {
          accessToken,
          method: 'PATCH',
          body: {
            status,
            updated_at: new Date().toISOString(),
          },
        }
      )

      if (error) {
        throw new Error(error || 'Failed to update status')
      }

      return { success: true }
    },
    onSuccess: async () => {
      await invalidateUserRelated()
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
