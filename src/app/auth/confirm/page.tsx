'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { decodeAndValidateJwt } from '@/lib/auth/jwt'
import { REDIRECT_DELAY_MS, storeInviteTokens, captureHashTokens, withTimeout, type HashTokens } from '@/lib/auth/constants'
import { fetchApi } from '@/lib/api-client'

interface UserRecord {
  id: string
  role: string
  status: string
}

// 35s master timeout: 3 retries at 5+8+12 = 25s of waiting, plus ~10s for JWT/API processing
const MASTER_TIMEOUT_MS = 35000

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
      try {
        return await fetchApi<UserRecord>(
          `/api/users/by-auth-id/${authUserId}`,
          accessToken,
          'Failed to fetch user'
        )
      } catch {
        return null
      }
    }

    const { data } = await supabase
      .from('users')
      .select('id, role, status')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    return data
  }

  const handleInvitedUser = async (user: UserRecord, accessToken?: string) => {
    // Update status to onboarding via Django API
    if (accessToken) {
      try {
        await fetchApi(
          `/api/user/profile`,
          accessToken,
          'Failed to update status',
          {
            method: 'PUT',
            body: { status: 'onboarding' }
          }
        )
      } catch (err) {
        console.error('Failed to update user status:', err)
      }
    } else {
      await supabase
        .from('users')
        .update({ status: 'onboarding', updated_at: new Date().toISOString() })
        .eq('id', user.id)
    }

    // Store tokens and navigate immediately - don't wait for setSession()
    // The setup-account page will use stored tokens directly (fast path)
    // setSession() can complete in the background
    if (accessToken && initialHashTokens?.refreshToken) {
      console.log(`[ConfirmSession] Storing tokens to localStorage`)
      storeInviteTokens(accessToken, initialHashTokens.refreshToken)

      // Fire and forget - setSession will complete in background
      // This avoids the 25s wait when setSession hangs
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: initialHashTokens.refreshToken
      }).then(() => {
        console.log(`[ConfirmSession] setSession completed in background`)
      }).catch((err) => {
        console.log(`[ConfirmSession] setSession failed in background:`, err)
      })
    }

    console.log(`[ConfirmSession] Navigating to /setup-account`)
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
