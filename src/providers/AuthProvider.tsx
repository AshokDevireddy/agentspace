'use client'

import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { AUTH_RETRY_TIMEOUTS } from '@/lib/auth/constants'
import type { User } from '@supabase/supabase-js'

export type UserData = {
  role: 'admin' | 'agent' | 'client'
  status: 'active' | 'onboarding' | 'invited' | 'inactive'
  theme_mode: 'light' | 'dark' | 'system' | null
  is_admin: boolean
  agency_id: string | null
  subscription_tier: 'free' | 'pro' | 'expert'
}

type AuthContextType = {
  user: User | null
  userData: UserData | null
  loading: boolean
  isHydrated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUserData: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  isHydrated: false,
  signIn: async () => {},
  signOut: async () => {},
  refreshUserData: async () => {},
})

// Serializable user data passed from server (full User type has methods that can't be serialized)
type SerializedUser = {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}

type AuthProviderProps = {
  children: React.ReactNode
  initialUser?: SerializedUser | null
  initialUserData?: UserData | null
}

// Auth timeout for edge cases when server didn't provide session (8 seconds max)
const AUTH_FALLBACK_TIMEOUT_MS = 8000

// Pages that don't require auth redirect
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password', '/setup-account', '/auth/confirm', '/auth/callback']

export function AuthProvider({
  children,
  initialUser = null,
  initialUserData = null
}: AuthProviderProps) {
  // Start with server-provided data (no loading flash on hard refresh!)
  const [user, setUser] = useState<User | null>(initialUser as User | null)
  const [userData, setUserData] = useState<UserData | null>(initialUserData)
  // If server provided user, we're not in loading state
  const [loading, setLoading] = useState(!initialUser)
  const [isHydrated, setIsHydrated] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const supabaseRef = useRef<ReturnType<typeof createClient>>(null!)
  supabaseRef.current ??= createClient()
  const supabase = supabaseRef.current

  // Guard against concurrent signIn calls to prevent race conditions
  const signInInProgressRef = useRef(false)

  // Mark as hydrated after first client-side render
  // This prevents hydration mismatch between server and client
  useEffect(() => {
    console.log('[AuthProvider] Setting isHydrated=true')
    setIsHydrated(true)
  }, [])

  const fetchUserData = async (authUserId: string): Promise<UserData | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, status, theme_mode, is_admin, agency_id, subscription_tier')
        .eq('auth_user_id', authUserId)
        .single()

      if (error || !data) {
        console.error('[AuthProvider] Error fetching user data:', error)
        return null
      }

      return {
        role: data.role as 'admin' | 'agent' | 'client',
        status: data.status as 'active' | 'onboarding' | 'invited' | 'inactive',
        theme_mode: data.theme_mode as 'light' | 'dark' | 'system' | null,
        is_admin: data.is_admin || false,
        agency_id: data.agency_id || null,
        subscription_tier: (data.subscription_tier || 'free') as 'free' | 'pro' | 'expert'
      }
    } catch (error) {
      console.error('[AuthProvider] Unexpected error fetching user data:', error)
      return null
    }
  }

  const refreshUserData = useCallback(async () => {
    if (user?.id) {
      const data = await fetchUserData(user.id)
      setUserData(data)
    }
  }, [user?.id, supabase])

  useEffect(() => {
    // Wait for hydration before initializing auth
    // This prevents hydration mismatch on Vercel where server/client timing differs
    if (!isHydrated) {
      console.log('[AuthProvider] Waiting for hydration...')
      return
    }

    // If server already provided user data, skip client-side recovery
    // Just set up the auth state listener for logout/token refresh
    if (initialUser && user) {
      console.log('[AuthProvider] Using server-provided session, skipping client-side recovery')
      setLoading(false)

      // Set up auth state listener for logout/token refresh
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('[AuthProvider] Auth state changed:', event)
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session?.user) {
              setUser(session.user)
              const data = await fetchUserData(session.user.id)
              setUserData(data)
            }
          } else if (event === 'SIGNED_OUT') {
            setUser(null)
            setUserData(null)
          }
        }
      )

      return () => {
        subscription.unsubscribe()
      }
    }

    // Server didn't provide user - need to do client-side recovery
    // This handles edge cases like expired tokens or auth pages
    const initializeAuth = async () => {
      console.log('[AuthProvider] Starting client-side auth initialization...')

      // Set up timeout to prevent infinite loading
      const isAuthPage = AUTH_PAGES.some(page => pathname?.startsWith(page))
      let timeoutId: NodeJS.Timeout | null = null

      if (!isAuthPage) {
        timeoutId = setTimeout(() => {
          console.log('[AuthProvider] Auth timeout reached - redirecting to login')
          setUser(null)
          setUserData(null)
          setLoading(false)
          router.push('/login')
        }, AUTH_FALLBACK_TIMEOUT_MS)
      }

      try {
        // Step 1: Try getSession() first - instant, reads from localStorage/IndexedDB
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log('[AuthProvider] getSession result:', { hasSession: !!session, error: sessionError?.message })

        if (session?.user) {
          // Session found in cache - use it (fast path for normal navigation)
          console.log('[AuthProvider] Session found in cache, using cached user')
          if (timeoutId) clearTimeout(timeoutId)
          setUser(session.user)
          const data = await fetchUserData(session.user.id)
          setUserData(data)
          setLoading(false)
          return
        }

        // Step 2: No cached session - validate with server (handles hard refresh)
        // This is critical: on hard refresh, localStorage cache may be empty/stale
        // but the server still has valid session cookies
        console.log('[AuthProvider] No cached session, validating with server...')

        // Use shorter retry timeouts since we have the overall timeout
        const shortTimeouts = [3000, 4000]
        let lastError: Error | null = null

        for (let attempt = 0; attempt < shortTimeouts.length; attempt++) {
          const timeout = shortTimeouts[attempt]
          console.log(`[AuthProvider] Server validation attempt ${attempt + 1}/${shortTimeouts.length} (timeout: ${timeout}ms)`)

          try {
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Auth server validation timeout (${timeout}ms)`)), timeout)
            )

            const { data: { user: serverUser }, error: userError } = await Promise.race([
              supabase.auth.getUser(),
              timeoutPromise
            ]) as Awaited<ReturnType<typeof supabase.auth.getUser>>

            if (serverUser && !userError) {
              console.log('[AuthProvider] Server validation successful, user authenticated')
              if (timeoutId) clearTimeout(timeoutId)
              setUser(serverUser)
              const data = await fetchUserData(serverUser.id)
              setUserData(data)
              setLoading(false)
              return
            }

            // No user returned but no error - user is definitely logged out
            if (!userError) {
              console.log('[AuthProvider] Server confirmed no valid session')
              break
            }

            // Auth error - might be temporary, try again
            lastError = userError
            console.warn(`[AuthProvider] Attempt ${attempt + 1} failed:`, userError.message)
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err))
            console.warn(`[AuthProvider] Attempt ${attempt + 1} timed out or errored:`, lastError.message)
            // Continue to next attempt
          }
        }

        // All retries exhausted or server confirmed no session
        console.log('[AuthProvider] No valid session found after retries')
        if (lastError) {
          console.error('[AuthProvider] Last error was:', lastError.message)
        }

        if (timeoutId) clearTimeout(timeoutId)
        setUser(null)
        setUserData(null)
        setLoading(false)

        // Auto-redirect to login if not on an auth page
        if (!isAuthPage) {
          console.log('[AuthProvider] Not authenticated, redirecting to login')
          router.push('/login')
        }
      } catch (err) {
        console.error('[AuthProvider] Unexpected auth error:', err)
        if (timeoutId) clearTimeout(timeoutId)
        // On unexpected error, set user to null and allow page to render
        setUser(null)
        setUserData(null)
        setLoading(false)

        // Auto-redirect to login if not on an auth page
        if (!isAuthPage) {
          router.push('/login')
        }
      }
    }

    initializeAuth()

    // Listen for auth changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] Auth state changed:', event)
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            setUser(session.user)
            const data = await fetchUserData(session.user.id)
            setUserData(data)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setUserData(null)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, initialUser, pathname]) // supabase client is stable via ref

  const signIn = useCallback(async (email: string, password: string, expectedRole?: 'admin' | 'agent' | 'client') => {
    // Prevent concurrent signIn calls to avoid race conditions
    if (signInInProgressRef.current) {
      throw new Error('Sign in already in progress')
    }
    signInInProgressRef.current = true

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const { data: userProfile, error: userError } = await supabase
        .from('users')
        .select('role, status, theme_mode, is_admin, agency_id, subscription_tier')
        .eq('auth_user_id', data.user.id)
        .single()

      if (userError) throw new Error('User profile not found')
      // Allow both 'active' and 'onboarding' statuses - onboarding users need to complete setup
      if (userProfile.status !== 'active' && userProfile.status !== 'onboarding') {
        await supabase.auth.signOut()
        throw new Error(
          userProfile.status === 'invited'
            ? 'Please complete your account setup using the invitation link'
            : 'Your account has been deactivated'
        )
      }
      if (expectedRole && userProfile.role !== expectedRole) {
        await supabase.auth.signOut()
        throw new Error(`Please use the ${userProfile.role} login tab`)
      }

      setUser(data.user)
      setUserData({
        role: userProfile.role as 'admin' | 'agent' | 'client',
        status: userProfile.status as 'active' | 'onboarding' | 'invited' | 'inactive',
        theme_mode: userProfile.theme_mode as 'light' | 'dark' | 'system' | null,
        is_admin: userProfile.is_admin || false,
        agency_id: userProfile.agency_id || null,
        subscription_tier: (userProfile.subscription_tier || 'free') as 'free' | 'pro' | 'expert'
      })

      router.push(userProfile.role === 'client' ? '/client/dashboard' : '/')
    } finally {
      signInInProgressRef.current = false
    }
  }, [supabase, router])

  const signOut = useCallback(async () => {
    // 1. Clear all TanStack Query cache first (prevents stale data on re-login)
    queryClient.clear()

    // 2. Clear local state (localStorage filters)
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('filter_')) keysToRemove.push(key)
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    }

    // 3. Clear React state
    setUser(null)
    setUserData(null)

    // 4. Invalidate server session (non-blocking - proceed with redirect on error)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('[AuthProvider] Server signOut failed:', err)
      // Continue with redirect - local state is already cleared
    }

    // 5. Use Next.js router for clean navigation (no hard refresh needed)
    router.push('/login')
  }, [supabase, router, queryClient])

  const contextValue = useMemo(() => ({
    user, userData, loading, isHydrated, signIn, signOut, refreshUserData
  }), [user, userData, loading, isHydrated, signIn, signOut, refreshUserData])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  return useContext(AuthContext)
}