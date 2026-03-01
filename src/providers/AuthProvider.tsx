'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { initTokenFromCookie, setAccessToken, getAccessToken, clearAccessToken } from '@/lib/auth/token-store'
import { getApiBaseUrl } from '@/lib/api-config'
import { AUTH_PATHS } from '@/lib/auth/constants'

export type UserData = {
  id: string
  authUserId: string
  email: string
  role: 'admin' | 'agent' | 'client'
  status: 'active' | 'onboarding' | 'invited' | 'inactive'
  themeMode: 'light' | 'dark' | 'system' | null
  isAdmin: boolean
  agencyId: string | null
  subscriptionTier: 'free' | 'basic' | 'pro' | 'expert'
}

type AuthContextType = {
  user: UserData | null
  loading: boolean
  isHydrated: boolean
  signIn: (email: string, password: string) => Promise<{ user: UserData; agency: { whitelabelDomain: string | null } }>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isHydrated: false,
  signIn: async () => { throw new Error('AuthProvider not initialized') },
  signOut: async () => {},
  refreshUser: async () => {},
})

type AuthProviderProps = {
  children: React.ReactNode
  initialUser?: UserData | null
  initialAccessToken?: string | null
}

export function AuthProvider({
  children,
  initialUser = null,
  initialAccessToken = null,
}: AuthProviderProps) {
  const [user, setUser] = useState<UserData | null>(initialUser)
  const [loading, setLoading] = useState(!initialUser)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const isRefreshingRef = useRef(false)
  const tokenInitializedRef = useRef(false)
  const queryClient = useQueryClient()

  // Initialize token synchronously BEFORE children render to prevent race conditions
  // where queries fire before the token is available in the module store
  if (!tokenInitializedRef.current) {
    if (initialAccessToken) {
      setAccessToken(initialAccessToken)
    } else if (typeof window !== 'undefined') {
      initTokenFromCookie()
    }
    tokenInitializedRef.current = true
  }

  // Mark hydration complete on mount
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Clear auth state, cancel in-flight queries, and redirect to /login
  const handleAuthFailure = useCallback(() => {
    clearAccessToken()
    setUser(null)
    queryClient.cancelQueries()
    if (typeof window !== 'undefined' && !AUTH_PATHS.some(p => window.location.pathname.startsWith(p))) {
      window.location.href = '/login'
    }
  }, [queryClient])

  // Fetch user data from Django /api/auth/session
  const refreshUser = useCallback(async () => {
    try {
      const data = await apiClient.get<{
        authenticated: boolean
        user: {
          id: string
          email: string
          agencyId: string
          role: string
          isAdmin: boolean
          status: string
          subscriptionTier: string
        } | null
      }>('/api/auth/session/')
      if (data.authenticated && data.user) {
        setUser({
          id: data.user.id,
          authUserId: '', // Session endpoint doesn't return this
          email: data.user.email,
          role: data.user.role as UserData['role'],
          status: data.user.status as UserData['status'],
          themeMode: null,
          isAdmin: data.user.isAdmin,
          agencyId: data.user.agencyId,
          subscriptionTier: (data.user.subscriptionTier || 'free') as UserData['subscriptionTier'],
        })
      } else {
        handleAuthFailure()
      }
    } catch {
      handleAuthFailure()
    }
  }, [handleAuthFailure])

  // Initialize session on mount if no initial user
  useEffect(() => {
    if (!initialUser && isHydrated) {
      if (getAccessToken()) {
        refreshUser().finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    } else if (initialUser) {
      setLoading(false)
    }
  }, [initialUser, isHydrated, refreshUser])

  // Listen for auth:token-expired from QueryProvider and refresh via Django
  useEffect(() => {
    const handleTokenExpired = async () => {
      if (isRefreshingRef.current) return
      isRefreshingRef.current = true

      try {
        // Call Django refresh endpoint — refresh_token is sent via httpOnly cookie
        const baseUrl = getApiBaseUrl()
        const res = await fetch(`${baseUrl}/api/auth/refresh/`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.access_token) {
            setAccessToken(data.access_token)
            window.dispatchEvent(new Event('auth:refresh-complete'))
            return
          }
        }

        handleAuthFailure()
      } catch {
        handleAuthFailure()
      } finally {
        isRefreshingRef.current = false
      }
    }

    window.addEventListener('auth:token-expired', handleTokenExpired)
    return () => window.removeEventListener('auth:token-expired', handleTokenExpired)
  }, [handleAuthFailure])

  // Sign in via Django — Django sets cookies + returns tokens
  const signIn = useCallback(async (email: string, password: string) => {
    const baseUrl = getApiBaseUrl()
    const res = await fetch(`${baseUrl}/api/auth/login/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Login failed' }))
      throw new Error(error.message || error.detail || 'Login failed')
    }

    const data = await res.json()

    // Django set cookies in the response. Store token in memory.
    if (data.access_token) {
      setAccessToken(data.access_token)
    }

    const userData = data.user
    if (!userData) {
      throw new Error('No user data in login response')
    }

    // Validate user status
    if (userData.status !== 'active' && userData.status !== 'onboarding') {
      throw new Error(
        userData.status === 'invited'
          ? 'Please complete your account setup using the invitation link'
          : 'Your account has been deactivated'
      )
    }

    const userObj: UserData = {
      id: userData.id,
      authUserId: '',
      email: userData.email,
      role: userData.role,
      status: userData.status,
      themeMode: null,
      isAdmin: userData.is_admin,
      agencyId: userData.agency_id,
      subscriptionTier: userData.subscription_tier || 'free',
    }

    setUser(userObj)

    return {
      user: userObj,
      agency: { whitelabelDomain: userData.whitelabel_domain || null },
    }
  }, [])

  // Sign out — Django revokes + clears cookies
  const signOut = useCallback(async () => {
    setIsLoggingOut(true)

    // Capture token before clearing — Django logout requires Bearer auth
    const token = getAccessToken()

    // Clear auth state FIRST to prevent 401 → refresh → retry loops
    clearAccessToken()
    setUser(null)

    // Cancel in-flight queries before clearing cache to stop pending 401 retries
    queryClient.cancelQueries()
    queryClient.clear()

    // Clear localStorage filters
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('filter_')) keysToRemove.push(key)
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    }

    // Call Django logout with raw fetch — bypasses apiClient's 401 retry mechanism.
    // Uses the saved token for auth + credentials: 'include' for cookie cleanup.
    try {
      const baseUrl = getApiBaseUrl()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      await fetch(`${baseUrl}/api/auth/logout/`, {
        method: 'POST',
        credentials: 'include',
        headers,
      })
    } catch {
      // Ignore errors — we're logging out regardless
    }

    // Small delay to ensure overlay renders, then redirect
    await new Promise(resolve => setTimeout(resolve, 50))
    window.location.href = '/login'
  }, [queryClient])

  const contextValue = useMemo(() => ({
    user,
    loading,
    isHydrated,
    signIn,
    signOut,
    refreshUser,
  }), [user, loading, isHydrated, signIn, signOut, refreshUser])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}

      {/* Logout overlay - covers entire screen during logout */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[99999] bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-foreground">Logging out...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  return useContext(AuthContext)
}
