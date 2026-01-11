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
  // Always start with loading=true, we'll set to false after Supabase client is initialized
  const [loading, setLoading] = useState(true)
  const [isHydrated, setIsHydrated] = useState(false)
  const [supabaseReady, setSupabaseReady] = useState(false)
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

  // Initialize Supabase client session from cookies
  // This ensures the browser client is authenticated before queries run
  useEffect(() => {
    if (!isHydrated) return

    const initSupabaseSession = async () => {
      console.log('[AuthProvider] Initializing Supabase client session...')
      try {
        // This call reads auth from cookies and initializes the client
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[AuthProvider] Supabase session initialized:', { hasSession: !!session })

        if (session?.user) {
          // Update user state with the full User object from Supabase
          setUser(session.user)
        }
        setSupabaseReady(true)

        // Only set loading to false after Supabase is ready
        if (initialUser || session?.user) {
          setLoading(false)
        }
      } catch (error) {
        console.error('[AuthProvider] Failed to initialize Supabase session:', error)
        setSupabaseReady(true)
        setLoading(false)
      }
    }

    initSupabaseSession()
  }, [isHydrated, supabase, initialUser])

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
    // Wait for Supabase to be initialized before continuing
    if (!supabaseReady) {
      console.log('[AuthProvider] Waiting for Supabase to be ready...')
      return
    }

    // If we have a user (from server or Supabase session), just set up auth state listener
    if (user) {
      console.log('[AuthProvider] User authenticated, setting up auth state listener')

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

    // Track resolution state - can be resolved by either validation loop OR auth listener
    const authResolved = { current: false }
    const isAuthPage = AUTH_PAGES.some(page => pathname?.startsWith(page))
    let fallbackTimeoutId: NodeJS.Timeout | null = null
    let subscriptionCleanup: (() => void) | null = null

    // Helper to resolve auth state (called by either path)
    const resolveAuth = async (authenticated: boolean, authUser?: User | null, skipDataFetch = false) => {
      if (authResolved.current) return false // Already resolved
      authResolved.current = true

      if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId)

      if (authenticated && authUser) {
        setUser(authUser)
        if (!skipDataFetch) {
          const data = await fetchUserData(authUser.id)
          setUserData(data)
        }
      } else {
        setUser(null)
        setUserData(null)
      }
      setLoading(false)
      return true
    }

    // Set up auth state listener FIRST - it may fire before validation completes
    // This catches SIGNED_IN events from setSession() in /auth/confirm
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] Auth state changed:', event)

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          // Auth state confirmed via listener - resolve immediately
          // skipDataFetch=false means resolveAuth will fetch user data
          const resolved = await resolveAuth(true, session.user, false)
          if (resolved) {
            console.log('[AuthProvider] Resolved via', event, 'event')
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setUserData(null)
        }
      }
    )
    subscriptionCleanup = () => subscription.unsubscribe()

    // Set up fallback timeout for non-auth pages
    if (!isAuthPage) {
      fallbackTimeoutId = setTimeout(() => {
        if (!authResolved.current) {
          console.log('[AuthProvider] Fallback timeout reached - redirecting to login')
          resolveAuth(false)
          router.push('/login')
        }
      }, AUTH_FALLBACK_TIMEOUT_MS)
    }

    // Start validation
    const initializeAuth = async () => {
      console.log('[AuthProvider] Starting client-side auth initialization...')

      try {
        // Step 1: Try getSession() first - instant, reads from localStorage/IndexedDB
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log('[AuthProvider] getSession result:', { hasSession: !!session, error: sessionError?.message })

        if (session?.user) {
          // Session found in cache - use it (fast path for normal navigation)
          console.log('[AuthProvider] Session found in cache, using cached user')
          const resolved = await resolveAuth(true, session.user)
          if (resolved) return
        }

        // Check if already resolved by auth listener
        if (authResolved.current) {
          console.log('[AuthProvider] Already resolved by auth listener, skipping validation')
          return
        }

        // Step 2: No cached session - validate with server (handles hard refresh)
        // This is critical: on hard refresh, localStorage cache may be empty/stale
        // but the server still has valid session cookies
        console.log('[AuthProvider] No cached session, validating with server...')

        // Use AUTH_RETRY_TIMEOUTS for cold start resilience
        let lastError: Error | null = null

        for (let attempt = 0; attempt < AUTH_RETRY_TIMEOUTS.length; attempt++) {
          // Check if already resolved by auth listener before each attempt
          if (authResolved.current) {
            console.log('[AuthProvider] Resolved by auth listener during validation')
            return
          }

          const timeout = AUTH_RETRY_TIMEOUTS[attempt]
          console.log(`[AuthProvider] Server validation attempt ${attempt + 1}/${AUTH_RETRY_TIMEOUTS.length} (timeout: ${timeout}ms)`)

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
              const resolved = await resolveAuth(true, serverUser)
              if (resolved) return
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

        // Check one more time if resolved by auth listener
        if (authResolved.current) {
          console.log('[AuthProvider] Resolved by auth listener after validation loop')
          return
        }

        // All retries exhausted or server confirmed no session
        console.log('[AuthProvider] No valid session found after retries')
        if (lastError) {
          console.error('[AuthProvider] Last error was:', lastError.message)
        }

        await resolveAuth(false)

        // Auto-redirect to login if not on an auth page
        if (!isAuthPage) {
          console.log('[AuthProvider] Not authenticated, redirecting to login')
          router.push('/login')
        }
      } catch (err) {
        console.error('[AuthProvider] Unexpected auth error:', err)
        await resolveAuth(false)

        // Auto-redirect to login if not on an auth page
        if (!isAuthPage) {
          router.push('/login')
        }
      }
    }

    initializeAuth()

    // Cleanup function handles:
    // 1. Unsubscribe auth listener
    // 2. Clear fallback timeout
    // 3. Mark as resolved to stop any in-flight validation
    return () => {
      authResolved.current = true // Stop validation loop
      subscriptionCleanup?.()
      if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseReady, user, pathname]) // supabase client is stable via ref

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