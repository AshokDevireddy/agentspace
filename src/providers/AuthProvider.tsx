'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

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
}

export function AuthProvider({
  children,
  initialUser = null
}: AuthProviderProps) {
  const [user, setUser] = useState<UserData | null>(initialUser)
  const [loading, setLoading] = useState(!initialUser)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()

  // Mark as hydrated after first client-side render
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Proactive token refresh - checks every minute and refreshes if needed
  useEffect(() => {
    if (!user) return // Only run when logged in

    const checkAndRefreshToken = async () => {
      try {
        const res = await fetch('/api/auth/refresh-session', {
          method: 'POST',
          credentials: 'include',
        })
        const data = await res.json()

        if (data.error) {
          // Refresh failed - redirect to login
          console.warn('[Auth] Token refresh failed:', data.error)
          window.location.href = '/login'
          return
        }

        if (data.refreshed) {
          console.info('[Auth] Token refreshed successfully')
        }
      } catch (error) {
        console.error('[Auth] Token refresh check failed:', error)
      }
    }

    // Check immediately on mount
    checkAndRefreshToken()

    // Then check every minute
    const interval = setInterval(checkAndRefreshToken, 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  // Fetch user session from Next.js API route
  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      const data = await res.json()

      if (data.authenticated && data.user) {
        setUser({
          id: data.user.id,
          authUserId: data.user.authUserId,
          email: data.user.email,
          role: data.user.role,
          status: data.user.status,
          themeMode: data.user.themeMode,
          isAdmin: data.user.isAdmin,
          agencyId: data.user.agencyId,
          subscriptionTier: data.user.subscriptionTier || 'free',
        })
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  // Initialize session on mount if no initial user
  useEffect(() => {
    if (!initialUser && isHydrated) {
      refreshUser().finally(() => setLoading(false))
    } else if (initialUser) {
      setLoading(false)
    }
  }, [initialUser, isHydrated, refreshUser])

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || 'Login failed')
    }

    const data = await res.json()

    // Validate user status
    if (data.user.status !== 'active' && data.user.status !== 'onboarding') {
      throw new Error(
        data.user.status === 'invited'
          ? 'Please complete your account setup using the invitation link'
          : 'Your account has been deactivated'
      )
    }

    setUser({
      id: data.user.id,
      authUserId: data.user.authUserId,
      email: data.user.email,
      role: data.user.role,
      status: data.user.status,
      themeMode: null,
      isAdmin: data.user.isAdmin,
      agencyId: data.user.agencyId,
      subscriptionTier: data.user.subscriptionTier || 'free',
    })

    return data
  }, [])

  const signOut = useCallback(async () => {
    // Show loading overlay to hide UI during logout
    setIsLoggingOut(true)

    // Clear TanStack Query cache (prevents stale data on re-login)
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

    // Start server signOut (fire and forget - don't await to avoid delay)
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(err => {
      console.error('[AuthProvider] Server signOut failed:', err)
    })

    // Small delay to ensure overlay renders, then redirect
    await new Promise(resolve => setTimeout(resolve, 50))

    // Hard redirect to login page
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
