'use client'

import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isHydrated, setIsHydrated] = useState(false)
  const router = useRouter()
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

    // Hybrid approach: Try getSession() first (fast, from cache), fallback to getUser() (server validation)
    // This handles hard refresh where localStorage cache may be stale but server session is valid
    const initializeAuth = async () => {
      console.log('[AuthProvider] Starting auth initialization...')
      try {
        // Step 1: Try getSession() first - instant, reads from localStorage/IndexedDB
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log('[AuthProvider] getSession result:', { hasSession: !!session, error: sessionError?.message })

        if (session?.user) {
          // Session found in cache - use it (fast path for normal navigation)
          console.log('[AuthProvider] Session found in cache, using cached user')
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

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Auth server validation timeout')), 5000)
        )

        const { data: { user: serverUser }, error: userError } = await Promise.race([
          supabase.auth.getUser(),
          timeoutPromise
        ]) as Awaited<ReturnType<typeof supabase.auth.getUser>>

        if (serverUser && !userError) {
          console.log('[AuthProvider] Server validation successful, user authenticated')
          setUser(serverUser)
          const data = await fetchUserData(serverUser.id)
          setUserData(data)
          setLoading(false)
          return
        }

        // No session in cache and server validation failed - user is truly logged out
        console.log('[AuthProvider] No valid session found, user is logged out')
        setUser(null)
        setUserData(null)
        setLoading(false)
      } catch (err) {
        console.error('[AuthProvider] Auth error (possibly timeout):', err)
        // On timeout or error, set user to null and allow page to render
        setUser(null)
        setUserData(null)
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
  }, [isHydrated]) // supabase client is stable via ref

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