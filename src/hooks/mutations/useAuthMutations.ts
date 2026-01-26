/**
 * Authentication-related mutation hooks for TanStack Query
 * Used by auth pages (register, reset-password, onboarding, login, setup-account)
 */

import { useMutation } from '@tanstack/react-query'
import { useInvalidation } from '../useInvalidation'
import { getAuthEndpoint } from '@/lib/api-config'
import { authApi, AuthApiError } from '@/lib/api/auth'

// ============ Register Mutation ============

interface RegisterInput {
  email: string
  firstName: string
  lastName: string
  phoneNumber: string
  agencyName?: string
}

interface RegisterResponse {
  success: boolean
  message?: string
  user_id?: string
  agency_id?: string
}

/**
 * Register a new user via backend API
 */
export function useRegister(options?: {
  onSuccess?: (data: RegisterResponse) => void
  onError?: (error: Error) => void
}) {
  return useMutation<RegisterResponse, Error, RegisterInput>({
    mutationFn: async (input) => {
      try {
        const result = await authApi.register({
          email: input.email,
          first_name: input.firstName,
          last_name: input.lastName,
          phone_number: input.phoneNumber,
          agency_name: input.agencyName || '',
        })
        return {
          success: true,
          message: result.message,
          user_id: result.user_id,
          agency_id: result.agency_id,
        }
      } catch (err) {
        if (err instanceof AuthApiError) {
          throw new Error(err.message)
        }
        throw err
      }
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
}

/**
 * Request password reset email via backend API
 */
export function useResetPassword(options?: {
  onSuccess?: (data: ResetPasswordResponse) => void
  onError?: (error: Error) => void
}) {
  return useMutation<ResetPasswordResponse, Error, ResetPasswordInput>({
    mutationFn: async (input) => {
      try {
        const result = await authApi.forgotPassword({ email: input.email })
        return {
          success: true,
          message: result.message,
        }
      } catch (err) {
        if (err instanceof AuthApiError) {
          throw new Error(err.message)
        }
        throw err
      }
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

// ============ Sign In Mutation ============

interface SignInApiResponse {
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
 * Sign in user via backend API
 */
export function useSignIn(options?: {
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

      const response = await withAuthTimeout(
        fetch(getAuthEndpoint('login'), {
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

      const data: SignInApiResponse = await response.json()

      // Set the Supabase session with the tokens from the API
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })

      if (sessionError) {
        throw new Error('Failed to establish session')
      }

      // Fetch agency data for whitelabel validation
      const agencyPromise = Promise.resolve(
        supabase
          .from('agencies')
          .select('whitelabel_domain')
          .eq('id', data.user.agency_id)
          .single()
      )

      const { data: agencyData, error: agencyError } = await withAuthTimeout(agencyPromise)

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

// ============ Update Password Mutation ============

interface UpdatePasswordInput {
  accessToken: string
  newPassword: string
}

interface UpdatePasswordResponse {
  success: boolean
}

/**
 * Update user password using access token via backend API
 * Used by forgot-password and setup-account pages
 */
export function useUpdatePassword(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  return useMutation<UpdatePasswordResponse, Error, UpdatePasswordInput>({
    mutationFn: async ({ accessToken, newPassword }) => {
      try {
        await authApi.resetPassword({
          access_token: accessToken,
          password: newPassword,
        })
        return { success: true }
      } catch (err) {
        if (err instanceof AuthApiError) {
          throw new Error(err.message)
        }
        throw err
      }
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}

// ============ Setup Account Mutation ============

interface SetupAccountInput {
  accessToken: string
  password?: string
  firstName?: string
  lastName?: string
  phoneNumber?: string
}

interface SetupAccountResponse {
  success: boolean
}

/**
 * Setup account during onboarding (set password and update profile) via backend API
 * Used by setup-account page
 */
export function useSetupAccount(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const { invalidateUserRelated } = useInvalidation()

  return useMutation<SetupAccountResponse, Error, SetupAccountInput>({
    mutationFn: async ({ accessToken, password, firstName, lastName, phoneNumber }) => {
      try {
        await authApi.setupAccount(accessToken, {
          password,
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
        })
        return { success: true }
      } catch (err) {
        if (err instanceof AuthApiError) {
          throw new Error(err.message)
        }
        throw err
      }
    },
    onSuccess: async () => {
      await invalidateUserRelated()
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

// ============ Update User Profile Mutation ============

interface UpdateUserProfileInput {
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
 * Update user profile data via Django API
 * Used by setup-account page for profile updates
 */
export function useUpdateUserProfile(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const { invalidateUserRelated } = useInvalidation()

  return useMutation<UpdateUserProfileResponse, Error, UpdateUserProfileInput>({
    mutationFn: async ({ data }) => {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to update profile')
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
  status: string
}

interface UpdateUserStatusResponse {
  success: boolean
}

/**
 * Update user status via Django API
 * Used by auth/confirm page for status updates during email confirmation
 */
export function useUpdateUserStatus(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const { invalidateUserRelated } = useInvalidation()

  return useMutation<UpdateUserStatusResponse, Error, UpdateUserStatusInput>({
    mutationFn: async ({ status }) => {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to update status')
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
