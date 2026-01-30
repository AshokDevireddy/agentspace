/**
 * Secure User Context Utility
 *
 * SECURITY: This is the single source of truth for user context in API routes.
 * Always use this instead of getting agency_id from headers or request body.
 *
 * The agency_id is derived from the authenticated user's session via the Django backend,
 * preventing cross-tenant attacks where a malicious user could spoof
 * the x-agency-id header to access another tenant's data.
 */

import { getApiBaseUrl } from '@/lib/api-config'
import { getAccessToken } from '@/lib/session'

export interface UserContext {
  userId: string           // users.id (public.users primary key)
  authUserId: string       // auth.users.id (Supabase auth user ID)
  email: string
  agencyId: string         // SECURE: From authenticated user, never from headers
  role: string             // 'admin', 'agent', 'client'
  isAdmin: boolean
  status: string           // 'pre-invite', 'invited', 'onboarding', 'active', 'inactive'
  subscriptionTier: string | null
}

export type GetUserContextResult =
  | {
      success: true
      context: UserContext
    }
  | {
      success: false
      error: string
      status: 401 | 403 | 404 | 500
    }

/**
 * Get authenticated user context from the current session.
 *
 * SECURITY: This function derives all user data (including agency_id)
 * from the authenticated Django backend session. NEVER trust agency_id from
 * request headers or body.
 *
 * @returns UserContext if authenticated, error otherwise
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const result = await getUserContext()
 *
 *   if (!result.success) {
 *     return Response.json({ error: result.error }, { status: result.status })
 *   }
 *
 *   const { agencyId, userId, isAdmin } = result.context
 *   // Use agencyId safely - it's from the authenticated session
 * }
 * ```
 */
export async function getUserContext(): Promise<GetUserContextResult> {
  try {
    const accessToken = await getAccessToken()

    if (!accessToken) {
      return {
        success: false,
        error: 'Unauthorized',
        status: 401
      }
    }

    // Fetch user profile from Django backend
    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/user/profile/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      if (response.status === 401) {
        return {
          success: false,
          error: 'Unauthorized',
          status: 401
        }
      }
      if (response.status === 404) {
        console.error('[getUserContext] User not found in database')
        return {
          success: false,
          error: 'User not found',
          status: 404
        }
      }
      return {
        success: false,
        error: 'Failed to get user context',
        status: 500
      }
    }

    const userData = await response.json()

    // Check user status
    const status = userData.status || 'active'
    if (status === 'inactive') {
      return {
        success: false,
        error: 'Account is deactivated',
        status: 403
      }
    }

    return {
      success: true,
      context: {
        userId: userData.id,
        authUserId: userData.auth_user_id || userData.authUserId || userData.id,
        email: userData.email || '',
        agencyId: userData.agency_id || userData.agencyId,
        role: userData.role || 'agent',
        isAdmin: userData.is_admin || userData.isAdmin || userData.role === 'admin',
        status: status,
        subscriptionTier: userData.subscription_tier || userData.subscriptionTier || null,
      }
    }

  } catch (error) {
    console.error('[getUserContext] Unexpected error:', error)
    return {
      success: false,
      error: 'Internal server error',
      status: 500
    }
  }
}

/**
 * Get agency ID from authenticated session.
 *
 * Convenience function that just returns the agency ID.
 * Returns null if not authenticated.
 *
 * @example
 * ```typescript
 * const agencyId = await getAgencyId()
 * if (!agencyId) {
 *   return Response.json({ error: 'Unauthorized' }, { status: 401 })
 * }
 * ```
 */
export async function getAgencyId(): Promise<string | null> {
  const result = await getUserContext()
  if (!result.success) {
    return null
  }
  return result.context.agencyId
}

/**
 * Require authentication and return user context.
 *
 * Throws an error if not authenticated - useful for routes that should
 * always require auth (the middleware should catch it, but this is defense in depth).
 *
 * @throws Error if not authenticated
 *
 * @example
 * ```typescript
 * try {
 *   const context = await requireUserContext()
 *   // Use context.agencyId safely
 * } catch (error) {
 *   return Response.json({ error: error.message }, { status: 401 })
 * }
 * ```
 */
export async function requireUserContext(): Promise<UserContext> {
  const result = await getUserContext()
  if (!result.success) {
    throw new Error(result.error)
  }
  return result.context
}
