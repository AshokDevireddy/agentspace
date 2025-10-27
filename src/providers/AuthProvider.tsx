'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('=== AUTH PROVIDER: Auth State Change ===')
        console.log('Auth event:', event)
        console.log('Session object:', session)
        console.log('User from session:', session?.user)
        console.log('User ID:', session?.user?.id)
        console.log('User email:', session?.user?.email)
        console.log('User metadata:', session?.user?.user_metadata)

        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

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

    // Get user profile to check role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, status')
      .eq('auth_user_id', data.user.id)
      .single()

    if (userError) throw new Error('User profile not found')

    if (userData.status !== 'active') {
      await supabase.auth.signOut()
      throw new Error('Your account has been deactivated')
    }

    // Verify user is logging in with correct role if expectedRole is provided
    if (expectedRole && userData.role !== expectedRole) {
      await supabase.auth.signOut()
      throw new Error(`Please use the ${userData.role} login tab`)
    }

    // Route based on role
    if (userData.role === 'client') {
      router.push('/client/dashboard')
    } else {
      router.push('/')
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  return useContext(AuthContext)
}