/**
 * Authentication-related mutation hooks for TanStack Query
 * Used by auth pages (register, reset-password, onboarding, login, setup-account)
 */

import { useMutation } from '@tanstack/react-query'
import { useInvalidation } from '../useInvalidation'
import { supabaseRestFetch, updatePassword } from '@/lib/supabase/api'
import { getDjangoAuthEndpoint } from '@/lib/api-config'

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

// Timeout wrapper for auth operations
const withAuthTimeout = <T>(promise: Promise<T>, ms = 15000): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Login timed out. Please try again.')), ms)
  )
  return Promise.race([promise, timeout])
}

// ============ Django Sign In Mutation ============

interface DjangoSignInResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  user: {
    id: string
    email: string
    first_name: string
    last_name: string
    agency_id: string | null
    role: string
    is_admin: boolean
    status: string
    subscription_tier: string | null
  }
}

/**
 * Sign in user via Django backend API
 * Django calls Supabase Auth internally and returns Supabase tokens.
 * We then set these tokens in the Supabase client for seamless compatibility.
 */
export function useDjangoSignIn(options?: {
  onSuccess?: (data: SignInResponse) => void
  onError?: (error: Error) => void
}) {
  return useMutation<SignInResponse, Error, SignInInput>({
    mutationFn: async ({ email, password }) => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // Clear any existing session to prevent conflicts
      try {
        await Promise.race([
          supabase.auth.signOut({ scope: 'local' }),
          new Promise(resolve => setTimeout(resolve, 3000))
        ])
      } catch {
        // Ignore sign-out errors - continue with sign-in
      }

      // Call Django login endpoint
      const response = await withAuthTimeout(
        fetch(getDjangoAuthEndpoint('login'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        })
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Invalid login credentials')
      }

      const data: DjangoSignInResponse = await response.json()

      // Set the Supabase session with the tokens from Django
      // This allows all subsequent Supabase RPC calls to work seamlessly
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })

      if (sessionError) {
        throw new Error('Failed to establish session')
      }

      // Fetch agency data for whitelabel validation
      const { data: agencyData, error: agencyError } = await withAuthTimeout(
        supabase
          .from('agencies')
          .select('whitelabel_domain')
          .eq('id', data.user.agency_id)
          .single()
      )

      if (agencyError || !agencyData) {
        throw new Error('Agency not found')
      }

      return {
        user: {
          id: data.user.id,
          role: data.user.role,
          status: data.user.status,
          agency_id: data.user.agency_id || '',
        },
        agency: {
          whitelabel_domain: agencyData.whitelabel_domain,
        },
      }
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}

/**
 * Smart sign-in hook - permanently uses Django authentication
 */
export function useSmartSignIn(options?: {
  onSuccess?: (data: SignInResponse) => void
  onError?: (error: Error) => void
}) {
  // Permanently using Django auth
  return useDjangoSignIn(options)
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
