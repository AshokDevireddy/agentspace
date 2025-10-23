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
        // Log the full URL to see what we're receiving
        console.log('Confirm page URL:', window.location.href)
        console.log('Search params:', window.location.search)
        console.log('Hash params:', window.location.hash)

        // First, check if we already have a session (user clicked link while logged in)
        const { data: { session: existingSession } } = await supabase.auth.getSession()

        if (existingSession?.user) {
          console.log('Found existing session, routing user:', existingSession.user.id)
          await routeUser(existingSession.user.id)
          return
        }

        // 1) Handle modern OAuth-style callback with code hash fragment
        console.log('Attempting to exchange code for session...')
        const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href)

        if (exchangeError) {
          console.error('Exchange code error:', exchangeError)
        }

        if (!exchangeError && session?.user) {
          console.log('Successfully exchanged code, routing user:', session.user.id)
          await routeUser(session.user.id)
          return
        }

        // 2) Fallback: legacy flow using refresh_token in hash
        console.log('Trying legacy hash flow...')
        const hash = window.location.hash.substring(1)
        const urlParams = new URLSearchParams(hash)
        const refreshToken = urlParams.get('refresh_token')
        const accessToken = urlParams.get('access_token')

        if (accessToken || refreshToken) {
          console.log('Found tokens in hash, attempting to set session...')

          if (refreshToken) {
            const { error: refreshError } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
            if (!refreshError) {
              const { data: { user } } = await supabase.auth.getUser()
              if (user) {
                console.log('Successfully refreshed session, routing user:', user.id)
                await routeUser(user.id)
                return
              }
            } else {
              console.error('Refresh session error:', refreshError)
            }
          }
        }

        // 3) Check if user is already authenticated (after clicking magic link)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          console.log('Found authenticated user, routing:', user.id)
          await routeUser(user.id)
          return
        }

        // 4) If nothing worked, send to login
        console.error('All authentication methods failed')
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
        // Get user data
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, role, status')
          .eq('auth_user_id', authUserId)
          .maybeSingle()

        if (userError || !user) {
          console.error('User not found in users table:', userError)
          setMessage('Account not found. Redirecting to login...')
          setTimeout(() => router.push('/login'), 2000)
          return
        }

        // Handle user based on their status
        if (user.status === 'pending') {
          // First time clicking invite link - transition to onboarding
          console.log('Transitioning user from pending to onboarding')
          const { error: updateError } = await supabase
            .from('users')
            .update({ status: 'onboarding', updated_at: new Date().toISOString() })
            .eq('id', user.id)

          if (updateError) {
            console.error('Error updating user status:', updateError)
            // Continue anyway, they can still proceed to setup
          }

          setMessage('Setting up your account...')
          router.push('/setup-account')
          return
        }

        if (user.status === 'onboarding') {
          // User clicked link again but hasn't finished onboarding
          setMessage('Continue setting up your account...')
          router.push('/setup-account')
          return
        }

        if (user.status === 'active') {
          // User already set up, route to appropriate dashboard
          setMessage('Welcome back! Redirecting...')
          if (user.role === 'client') {
            router.push('/client/dashboard')
          } else {
            router.push('/')
          }
          return
        }

        // Handle inactive or other statuses
        console.error('User has invalid status:', user.status)
        setMessage('Account is not accessible. Please contact support.')
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
