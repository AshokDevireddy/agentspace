'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { decodeAndValidateJwt } from '@/lib/auth/jwt'
import { REDIRECT_DELAY_MS, storeInviteTokens, captureHashTokens, type HashTokens } from '@/lib/auth/constants'
import { apiClient } from '@/lib/api-client'
import { getClientAccessToken } from '@/lib/auth/client'

interface UserRecord {
  id: string
  role: string
  status: string
}

// 35s master timeout
const MASTER_TIMEOUT_MS = 35000

export default function ConfirmSession() {
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
      // Try hash tokens first (from email invite links)
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

      // Fallback: check for existing Django session
      try {
        const accessToken = await getClientAccessToken()
        if (accessToken) {
          // We have a session, try to get user info
          const response = await fetch('/api/auth/session', { credentials: 'include' })
          if (response.ok) {
            const data = await response.json()
            if (data.authenticated && data.user) {
              await routeUserByData(data.user)
              return
            }
          }
        }
      } catch (err) {
        console.error('Error checking existing session:', err)
      }

      // Try PKCE flow (code in query params) - redirect to callback route
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        // Redirect to callback route which handles code exchange
        router.push(`/auth/callback?code=${code}`)
        return
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
      const user = await fetchUserRecord(authUserId)

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

  const routeUserByData = async (userData: { id: string; role: string; status: string }) => {
    if (userData.status === 'invited') {
      // For invited users coming from existing session, redirect to setup
      completedRef.current = true
      setMessage('Continue setting up your account...')
      router.push('/setup-account')
      return
    }

    if (userData.status === 'onboarding') {
      completedRef.current = true
      setMessage('Continue setting up your account...')
      router.push('/setup-account')
      return
    }

    if (userData.status === 'active') {
      completedRef.current = true
      setMessage('Welcome back! Redirecting...')
      router.push(userData.role === 'client' ? '/client/dashboard' : '/')
      return
    }

    completedRef.current = true
    setMessage('Account is not accessible. Please contact support.')
    setTimeout(() => router.push('/login'), REDIRECT_DELAY_MS)
  }

  const fetchUserRecord = async (authUserId: string): Promise<UserRecord | null> => {
    try {
      return await apiClient.get<UserRecord>(
        `/api/users/by-auth-id/${authUserId}/`
      )
    } catch {
      return null
    }
  }

  const handleInvitedUser = async (user: UserRecord, accessToken?: string) => {
    // Update status to onboarding via Django API
    try {
      await apiClient.put('/api/user/profile/', { status: 'onboarding' })
    } catch (err) {
      console.error('Failed to update user status:', err)
    }

    // Store tokens for setup-account page to use
    if (accessToken && initialHashTokens?.refreshToken) {
      console.log(`[ConfirmSession] Storing tokens to localStorage`)
      storeInviteTokens(accessToken, initialHashTokens.refreshToken)
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
