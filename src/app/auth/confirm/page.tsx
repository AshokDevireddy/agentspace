'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { decodeAndValidateJwt } from '@/lib/auth/jwt'
import { supabaseRestFetch } from '@/lib/supabase/api'
import { REDIRECT_DELAY_MS, storeInviteTokens, captureHashTokens, withTimeout, type HashTokens } from '@/lib/auth/constants'

interface UserRecord {
  id: string
  role: string
  status: string
}

const MASTER_TIMEOUT_MS = 15000

export default function ConfirmSession() {
  const supabase = createClient()
  const router = useRouter()
  const [message, setMessage] = useState('Confirming your session...')
  const [initialHashTokens] = useState<HashTokens | null>(captureHashTokens)
  const processingRef = useRef(false)
  const completedRef = useRef(false)

  useEffect(() => {
    if (processingRef.current) return
    processingRef.current = true

    confirmSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Master timeout to prevent infinite loading
  useEffect(() => {
    const masterTimeout = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        setMessage('Session confirmation timed out. Redirecting to login...')
        router.push('/login?error=Session confirmation timed out. Please try your invitation link again.')
      }
    }, MASTER_TIMEOUT_MS)

    return () => clearTimeout(masterTimeout)
  }, [router])

  const confirmSession = async () => {
    try {
      // Try hash tokens first (from Supabase implicit flow)
      if (initialHashTokens) {
        const payload = decodeAndValidateJwt(initialHashTokens.accessToken)

        if (!payload) {
          completedRef.current = true
          setMessage('Your link has expired. Please request a new invitation.')
          setTimeout(() => router.push('/login?error=Your invitation link has expired. Please contact your administrator.'), REDIRECT_DELAY_MS)
          return
        }

        await routeUser(payload.sub, initialHashTokens.accessToken)
        return
      }

      // Fallback: check for existing session with timeout
      try {
        const { data: { user: existingUser } } = await withTimeout(supabase.auth.getUser())
        if (existingUser) {
          await routeUser(existingUser.id)
          return
        }
      } catch (err) {
        console.error('Error checking existing session:', err)
      }

      // Try PKCE flow (code in query params)
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (!error && session?.user) {
          await routeUser(session.user.id)
          return
        }
      }

      completedRef.current = true
      setMessage('Session confirmation failed. Redirecting to login...')
      setTimeout(() => router.push('/login?error=Invitation link has expired.'), REDIRECT_DELAY_MS)
    } catch (err) {
      console.error('Error in confirmSession:', err)
      completedRef.current = true
      setMessage('An error occurred. Redirecting to login...')
      setTimeout(() => router.push('/login'), REDIRECT_DELAY_MS)
    }
  }

  const routeUser = async (authUserId: string, accessToken?: string) => {
    try {
      const user = await fetchUserRecord(authUserId, accessToken)

      if (!user) {
        completedRef.current = true
        setMessage('Account not found. Redirecting to login...')
        setTimeout(() => router.push('/login'), REDIRECT_DELAY_MS)
        return
      }

      if (user.status === 'invited') {
        await handleInvitedUser(user, accessToken)
        return
      }

      if (user.status === 'onboarding') {
        completedRef.current = true
        setMessage('Continue setting up your account...')
        router.push('/setup-account')
        return
      }

      if (user.status === 'active') {
        completedRef.current = true
        setMessage('Welcome back! Redirecting...')
        router.push(user.role === 'client' ? '/client/dashboard' : '/')
        return
      }

      completedRef.current = true
      setMessage('Account is not accessible. Please contact support.')
      setTimeout(() => router.push('/login'), REDIRECT_DELAY_MS)
    } catch (err) {
      console.error('Error in routeUser:', err)
      completedRef.current = true
      setMessage('An error occurred. Redirecting to login...')
      setTimeout(() => router.push('/login'), REDIRECT_DELAY_MS)
    }
  }

  const fetchUserRecord = async (authUserId: string, accessToken?: string): Promise<UserRecord | null> => {
    if (accessToken) {
      const { data } = await supabaseRestFetch<UserRecord[]>(
        `/rest/v1/users?auth_user_id=eq.${authUserId}&select=id,role,status`,
        { accessToken }
      )
      return data?.[0] || null
    }

    const { data } = await supabase
      .from('users')
      .select('id, role, status')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    return data
  }

  const handleInvitedUser = async (user: UserRecord, accessToken?: string) => {
    // Update status to onboarding
    if (accessToken) {
      await supabaseRestFetch(
        `/rest/v1/users?id=eq.${user.id}`,
        {
          accessToken,
          method: 'PATCH',
          body: { status: 'onboarding', updated_at: new Date().toISOString() }
        }
      )
    } else {
      await supabase
        .from('users')
        .update({ status: 'onboarding', updated_at: new Date().toISOString() })
        .eq('id', user.id)
    }

    // Try to establish session, store tokens as fallback
    if (accessToken && initialHashTokens?.refreshToken) {
      try {
        await withTimeout(
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: initialHashTokens.refreshToken
          })
        )
      } catch (err) {
        console.error('Error setting session, storing tokens as fallback:', err)
        storeInviteTokens(accessToken, initialHashTokens.refreshToken)
      }
    }

    completedRef.current = true
    setMessage('Setting up your account...')
    router.push('/setup-account')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-lg text-foreground">{message}</p>
      </div>
    </div>
  )
}
