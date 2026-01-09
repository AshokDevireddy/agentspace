'use client'

import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  const supabaseRef = useRef<ReturnType<typeof createClient>>(null!)
  supabaseRef.current ??= createClient()
  const supabase = supabaseRef.current

  // Mark as hydrated after first client-side render
  // This prevents hydration mismatch between server and client
  useEffect(() => {
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
    if (!isHydrated) return

    // Use getUser() to validate session with server (not cached getSession())
    // This ensures the session is valid and not stale from localStorage
    const initializeAuth = async () => {
      const { data: { user: authUser }, error } = await supabase.auth.getUser()

      if (error || !authUser) {
        // Session invalid or doesn't exist - clear state
        setUser(null)
        setUserData(null)
        setLoading(false)
        return
      }

      setUser(authUser)
      const data = await fetchUserData(authUser.id)
      setUserData(data)
      setLoading(false)
    }

    initializeAuth()

    // Listen for auth changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Handle specific auth events
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
        // For INITIAL_SESSION event, we rely on initializeAuth() above
      }
    )

    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]) // supabase client is stable via ref

  const signIn = useCallback(async (email: string, password: string, expectedRole?: 'admin' | 'agent' | 'client') => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('role, status, theme_mode, is_admin, agency_id, subscription_tier')
      .eq('auth_user_id', data.user.id)
      .single()

    if (userError) throw new Error('User profile not found')
    if (userProfile.status !== 'active') {
      await supabase.auth.signOut()
      throw new Error('Your account has been deactivated')
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
  }, [supabase, router])

  const signOut = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('filter_')) keysToRemove.push(key)
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    }

    setUser(null)
    setUserData(null)

    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('[AuthProvider] signOut error:', err)
    }

    window.location.href = '/login'
  }, [supabase])

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