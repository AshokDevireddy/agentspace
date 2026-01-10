/**
 * Authentication-related mutation hooks for TanStack Query
 * Used by auth pages (register, reset-password, onboarding, login, setup-account)
 */

import { useMutation } from '@tanstack/react-query'
import { useInvalidation } from '../useInvalidation'
import { signInWithPassword, supabaseRestFetch, updatePassword } from '@/lib/supabase/api'
import { decodeAndValidateJwt } from '@/lib/auth/jwt'

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
    onSuccess: async () => {
      await invalidateUserRelated()
    },
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
  accessToken: string
  refreshToken: string
  user: SignInUserData
  agency: SignInAgencyData
}

/**
 * Sign in user with email and password
 * Returns access token, refresh token, user profile, and agency info
 */
export function useSignIn(options?: {
  onSuccess?: (data: SignInResponse) => void
  onError?: (error: Error) => void
}) {
  return useMutation<SignInResponse, Error, SignInInput>({
    mutationFn: async ({ email, password }) => {
      // Authenticate with Supabase
      const { data: signInData, error: signInError } = await signInWithPassword(email, password)

      if (signInError || !signInData) {
        throw new Error(signInError || 'Invalid login credentials')
      }

      const accessToken = signInData.access_token
      const refreshToken = signInData.refresh_token

      // Validate and decode the JWT
      const payload = decodeAndValidateJwt(accessToken)
      if (!payload) {
        throw new Error('Invalid token received')
      }

      const authUserId = payload.sub

      // Fetch user profile
      const { data: users, error: userError } = await supabaseRestFetch<SignInUserData[]>(
        `/rest/v1/users?auth_user_id=eq.${authUserId}&select=id,role,status,agency_id`,
        { accessToken }
      )

      if (userError || !users?.[0]) {
        throw new Error('User profile not found')
      }

      const userData = users[0]

      // Fetch agency info
      const { data: agencies, error: agencyError } = await supabaseRestFetch<SignInAgencyData[]>(
        `/rest/v1/agencies?id=eq.${userData.agency_id}&select=whitelabel_domain`,
        { accessToken }
      )

      if (agencyError || !agencies?.[0]) {
        throw new Error('Agency not found')
      }

      return {
        accessToken,
        refreshToken,
        user: userData,
        agency: agencies[0],
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
