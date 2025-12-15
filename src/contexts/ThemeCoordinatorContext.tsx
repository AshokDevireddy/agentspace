'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/providers/AuthProvider'
import { useAgencyBranding } from '@/contexts/AgencyBrandingContext'
import { usePathname } from 'next/navigation'

const AUTH_PAGES = [
  '/login',
  '/register',
  '/setup-account',
  '/forgot-password',
  '/reset-password',
  '/auth/confirm',
  '/unauthorized'
]

const THEME_DEBOUNCE_MS = 50
const DEFAULT_AUTH_THEME = 'light'
const DEFAULT_USER_THEME = 'system'
const CLIENT_THEME = 'light'

export function ThemeCoordinator({ children }: { children: React.ReactNode }) {
  const { user, userData } = useAuth()
  const { setTheme } = useTheme()
  const { branding, isWhiteLabel, loading: brandingLoading } = useAgencyBranding()
  const pathname = usePathname()

  const lastAppliedTheme = useRef<string | null>(null)
  const themeDebounceTimeout = useRef<NodeJS.Timeout | null>(null)
  const isAuthPage = AUTH_PAGES.includes(pathname)

  useEffect(() => {
    lastAppliedTheme.current = null
  }, [user?.id])

  useEffect(() => {
    if (isAuthPage && brandingLoading) return

    let newTheme: string | null = null

    if (isAuthPage) {
      newTheme = (isWhiteLabel && branding?.theme_mode) ? branding.theme_mode : DEFAULT_AUTH_THEME
    } else if (user && userData) {
      newTheme = userData.role === 'client' ? CLIENT_THEME : (userData.theme_mode || DEFAULT_USER_THEME)
    }

    if (!newTheme || lastAppliedTheme.current === newTheme) return

    if (themeDebounceTimeout.current) {
      clearTimeout(themeDebounceTimeout.current)
    }

    themeDebounceTimeout.current = setTimeout(() => {
      setTheme(newTheme)
      lastAppliedTheme.current = newTheme
      themeDebounceTimeout.current = null
    }, THEME_DEBOUNCE_MS)
  }, [user, userData, brandingLoading, branding, isWhiteLabel, isAuthPage, setTheme])

  useEffect(() => {
    return () => {
      if (themeDebounceTimeout.current) {
        clearTimeout(themeDebounceTimeout.current)
      }
    }
  }, [])

  return children
}
