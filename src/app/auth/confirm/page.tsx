'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfirmSession() {
  const supabase = createClient()
  const router = useRouter()
  const [message, setMessage] = useState('Confirming your session...')

  useEffect(() => {
    const confirmSession = async () => {
      try {
        // 1) Handle modern OAuth-style callback with code hash fragment
        const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href)

        if (!exchangeError && session) {
          await routeUser(session.user.id)
          return
        }

        // 2) Fallback: legacy flow using refresh_token in hash
        const hash = window.location.hash.substring(1)
        const urlParams = new URLSearchParams(hash)
        const refreshToken = urlParams.get('refresh_token')

        if (refreshToken) {
          const { error: refreshError } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
          if (!refreshError) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              await routeUser(user.id)
              return
            }
          }
        }

        // 3) If neither worked, send to login
        setMessage('Session confirmation failed. Redirecting to login...')
        setTimeout(() => router.push('/login'), 2000)

      } catch (err) {
        console.error('Unexpected error during session confirmation:', err)
        setMessage('An error occurred. Redirecting to login...')
        setTimeout(() => router.push('/login'), 2000)
      }
    }

    const routeUser = async (authUserId: string) => {
      try {
        // Check if user already exists in users table (returning user)
        const { data: existingUser, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('auth_user_id', authUserId)
          .maybeSingle()

        if (existingUser) {
          // User already set up, route to appropriate dashboard
          setMessage('Welcome back! Redirecting...')
          if (existingUser.role === 'client') {
            router.push('/client/dashboard')
          } else {
            router.push('/')
          }
          return
        }

        // Check if user is in pending_invite (new user)
        const { data: pendingUser, error: pendingError } = await supabase
          .from('pending_invite')
          .select('role')
          .eq('id', authUserId)
          .maybeSingle()

        if (pendingUser) {
          // New user needs to complete setup
          setMessage('Setting up your account...')
          router.push('/setup-account')
          return
        }

        // User not found in either table
        console.error('User not found in users or pending_invite')
        setMessage('Account not found. Redirecting to login...')
        setTimeout(() => router.push('/login'), 2000)

      } catch (err) {
        console.error('Error routing user:', err)
        setMessage('An error occurred. Redirecting to login...')
        setTimeout(() => router.push('/login'), 2000)
      }
    }

    confirmSession()
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-lg text-foreground">{message}</p>
      </div>
    </div>
  )
}
