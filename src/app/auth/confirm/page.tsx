'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfirmSession() {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const confirmSession = async () => {
      try {
        // 1) Handle modern OAuth-style callback with code hash fragment
        const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (!exchangeError && session) {
          router.push('/setup-account')
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
              router.push('/setup-account')
              return
            }
          }
        }

        // 3) If neither worked, send to login
        router.push('/login')

      } catch (err) {
        console.error('Unexpected error during session confirmation:', err)
        router.push('/login')
      }
    }

    confirmSession()
  }, [])

  return <p>Setting up your account...</p>
}
