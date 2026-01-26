/**
 * Auth API Client
 *
 * Typed client for backend auth endpoints. All auth operations route through
 * the backend API.
 */

import { getAuthEndpoint } from '@/lib/api-config'

// ============================================================================
// Types
// ============================================================================

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
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

export interface RegisterRequest {
  email: string
  first_name: string
  last_name: string
  phone_number?: string
  agency_name: string
}

export interface RegisterResponse {
  message: string
  user_id: string
  agency_id: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ForgotPasswordResponse {
  message: string
}

export interface ResetPasswordRequest {
  access_token: string
  password: string
}

export interface ResetPasswordResponse {
  message: string
}

export interface SetupAccountRequest {
  password?: string
  first_name?: string
  last_name?: string
  phone_number?: string
}

export interface SetupAccountResponse {
  message: string
}

export interface VerifyInviteRequest {
  email?: string
  token?: string
  access_token?: string
  refresh_token?: string
}

export interface VerifyInviteResponse {
  valid: boolean
  access_token: string
  refresh_token: string
}

export interface SessionResponse {
  authenticated: boolean
  user?: {
    id: string
    auth_user_id: string
    email: string
    agency_id: string | null
    role: 'admin' | 'agent' | 'client'
    is_admin: boolean
    status: 'active' | 'onboarding' | 'invited' | 'inactive'
    subscription_tier: string
    theme_mode: 'light' | 'dark' | 'system' | null
  }
  agency?: {
    display_name: string
    whitelabel_domain: string | null
    logo_url: string | null
  } | null
}

export interface ApiError {
  error: string
  message: string
}

// ============================================================================
// Error Handling
// ============================================================================

export class AuthApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'AuthApiError'
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json()

  if (!response.ok) {
    const apiError = data as ApiError
    throw new AuthApiError(
      apiError.error || 'Unknown',
      apiError.message || 'Request failed',
      response.status
    )
  }

  return data as T
}

// ============================================================================
// API Client
// ============================================================================

export const authApi = {
  /**
   * Login with email and password
   * Returns tokens and user data
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(getAuthEndpoint('login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse<LoginResponse>(response)
  },

  /**
   * Logout - invalidates session on server
   */
  async logout(accessToken: string): Promise<void> {
    try {
      await fetch(getAuthEndpoint('logout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      })
    } catch {
      // Ignore logout errors - local cleanup will still happen
    }
  },

  /**
   * Register new admin user with agency
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await fetch(getAuthEndpoint('register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse<RegisterResponse>(response)
  },

  /**
   * Send password reset email
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const response = await fetch(getAuthEndpoint('forgotPassword'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse<ForgotPasswordResponse>(response)
  },

  /**
   * Reset password using access token from recovery email
   */
  async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    const response = await fetch(getAuthEndpoint('resetPassword'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse<ResetPasswordResponse>(response)
  },

  /**
   * Setup account during onboarding (set password, update profile)
   * Requires valid access token in Authorization header
   */
  async setupAccount(accessToken: string, data: SetupAccountRequest): Promise<SetupAccountResponse> {
    const response = await fetch(getAuthEndpoint('setupAccount'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
    })
    return handleResponse<SetupAccountResponse>(response)
  },

  /**
   * Verify invite token
   * Accepts either OTP (email + token) or hash tokens (access_token + refresh_token)
   */
  async verifyInvite(data: VerifyInviteRequest): Promise<VerifyInviteResponse> {
    const response = await fetch(getAuthEndpoint('verifyInvite'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse<VerifyInviteResponse>(response)
  },

  /**
   * Get current session info
   */
  async getSession(accessToken: string): Promise<SessionResponse> {
    const response = await fetch(getAuthEndpoint('session'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    })
    return handleResponse<SessionResponse>(response)
  },

  /**
   * Refresh access token
   */
  async refresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    const response = await fetch(getAuthEndpoint('refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    return handleResponse(response)
  },
}
