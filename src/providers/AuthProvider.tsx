'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export type UserData = {
  role: 'admin' | 'agent' | 'client'
  theme_mode: 'light' | 'dark' | 'system' | null
}

type AuthContextType = {
  user: User | null
  userData: UserData | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUserData: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  refreshUserData: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Fetch user data from the users table
  const fetchUserData = async (authUserId: string): Promise<UserData | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, theme_mode')
        .eq('auth_user_id', authUserId)
        .single()

      if (error || !data) {
        console.error('[AuthProvider] Error fetching user data:', error)
        return null
      }

      return {
        role: data.role as 'admin' | 'agent' | 'client',
        theme_mode: data.theme_mode as 'light' | 'dark' | 'system' | null
      }
    } catch (error) {
      console.error('[AuthProvider] Unexpected error fetching user data:', error)
      return null
    }
  }

  // Refresh user data (called after theme updates)
  const refreshUserData = async () => {
    if (user?.id) {
      const data = await fetchUserData(user.id)
      setUserData(data)
    }
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          // Handle token refresh errors
          if (event === 'TOKEN_REFRESHED' && !session) {
            console.log('[AuthProvider] Token refresh failed, clearing user state')
            setUser(null)
            setUserData(null)
            setLoading(false)
            return
          }

          if (session?.user) {
            setUser(session.user)
            // Fetch user data including theme_mode
            const data = await fetchUserData(session.user.id)
            setUserData(data)
          } else {
            setUser(null)
            setUserData(null)
          }
          setLoading(false)
        } catch (error) {
          // Handle any errors during auth state change gracefully
          console.error('[AuthProvider] Error in auth state change:', error)
          setUser(null)
          setUserData(null)
          setLoading(false)
        }
      }
    )

    // Also handle initial session check errors
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('[AuthProvider] Session check error:', error)
          // Don't throw - just treat as no session
        }
        // onAuthStateChange will handle the actual state update
      } catch (err) {
        console.error('[AuthProvider] Failed to check session:', err)
        setLoading(false)
      }
    }
    checkSession()

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  const signIn = async (email: string, password: string, expectedRole?: 'admin' | 'agent' | 'client') => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error

    // Get user profile to check role and theme
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('role, status, theme_mode')
      .eq('auth_user_id', data.user.id)
      .single()

    if (userError) throw new Error('User profile not found')

    if (userProfile.status !== 'active') {
      await supabase.auth.signOut()
      throw new Error('Your account has been deactivated')
    }

    // Verify user is logging in with correct role if expectedRole is provided
    if (expectedRole && userProfile.role !== expectedRole) {
      await supabase.auth.signOut()
      throw new Error(`Please use the ${userProfile.role} login tab`)
    }

    // Store user data including theme_mode
    setUserData({
      role: userProfile.role as 'admin' | 'agent' | 'client',
      theme_mode: userProfile.theme_mode as 'light' | 'dark' | 'system' | null
    })

    // Route based on role
    if (userProfile.role === 'client') {
      router.push('/client/dashboard')
    } else {
      router.push('/')
    }
  }

  const signOut = async () => {
    // Clear all persisted user-specific data from localStorage before signing out
    if (typeof window !== 'undefined') {
      // Clear specific app keys
      const keysToRemove = [
        'dashboard_view_mode',
        'analytics_view_mode',
        'underwriting_form_data',
        'underwriting_results',
        'underwriting_show_advanced',
        'agents-visible-filters',
        'book-of-business-visible-filters',
        'nipr_active_job_id',
      ]
      keysToRemove.forEach(key => localStorage.removeItem(key))

      // Also clear pattern-based keys (filter_*, tour_*)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('filter_') || key.startsWith('tour_'))) {
          localStorage.removeItem(key)
        }
      }
    }

    const { error } = await supabase.auth.signOut()
    if (error) throw error
    router.push('/login')
  }

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    userData,
    loading,
    signIn,
    signOut,
    refreshUserData,
  }), [user, userData, loading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  return useContext(AuthContext)
}