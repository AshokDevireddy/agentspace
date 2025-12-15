'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/providers/AuthProvider'
import { useAgencyBranding } from '@/contexts/AgencyBrandingContext'
import { usePathname } from 'next/navigation'

type ThemeCoordinatorContextType = {
  isThemeReady: boolean
  currentTheme: string | undefined
  applyTheme: (theme: string, source: string) => void
}

const ThemeCoordinatorContext = createContext<ThemeCoordinatorContextType | undefined>(undefined)

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

export function ThemeCoordinatorProvider({ children }: { children: React.ReactNode }) {
  const { user, userData } = useAuth()
  const { setTheme, theme } = useTheme()
  const { branding, isWhiteLabel, loading: brandingLoading } = useAgencyBranding()
  const pathname = usePathname()
  const [isThemeReady, setIsThemeReady] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<string | undefined>(undefined)

  // Track last applied theme to prevent duplicate calls
  const lastAppliedTheme = useRef<string | null>(null)
  const themeDebounceTimeout = useRef<NodeJS.Timeout | null>(null)
  const isAuthPage = AUTH_PAGES.includes(pathname)

  // Reset lastAppliedTheme when user changes to allow fresh theme application
  useEffect(() => {
    lastAppliedTheme.current = null
  }, [user?.id])

  // Debounced theme application to prevent rapid changes
  const applyTheme = useCallback((newTheme: string, source: string) => {
    if (lastAppliedTheme.current === newTheme) {
      return // Already applied this theme
    }

    // Clear any pending debounced calls
    if (themeDebounceTimeout.current) {
      clearTimeout(themeDebounceTimeout.current)
    }

    themeDebounceTimeout.current = setTimeout(() => {
      setTheme(newTheme)
      setCurrentTheme(newTheme)
      lastAppliedTheme.current = newTheme
      themeDebounceTimeout.current = null
    }, THEME_DEBOUNCE_MS)
  }, [setTheme])

  useEffect(() => {
    // Wait for branding data on auth pages
    if (isAuthPage && brandingLoading) {
      return
    }

    if (isAuthPage) {
      // Auth page theme logic - handle white-label vs default
      if (isWhiteLabel && branding?.theme_mode) {
        applyTheme(branding.theme_mode, 'white-label-auth')
      } else {
        applyTheme('light', 'default-auth')
      }
      setIsThemeReady(true)
    } else if (user && userData) {
      // Authenticated page theme logic - use userData from AuthProvider
      if (userData.role === 'client') {
        // Clients always get light mode
        applyTheme('light', 'client-default')
      } else {
        // Admins/agents use their personal preference or default to system
        applyTheme(userData.theme_mode || 'system', 'user')
      }
      setIsThemeReady(true)
    } else if (user && !userData) {
      // User exists but userData not loaded yet - wait
      return
    }
  }, [user, userData, brandingLoading, branding, isWhiteLabel, isAuthPage, applyTheme])

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (themeDebounceTimeout.current) {
        clearTimeout(themeDebounceTimeout.current)
      }
    }
  }, [])

  const value = {
    isThemeReady,
    currentTheme: currentTheme || theme,
    applyTheme
  }

  return (
    <ThemeCoordinatorContext.Provider value={value}>
      {children}
    </ThemeCoordinatorContext.Provider>
  )
}

export function useThemeCoordinator() {
  const context = useContext(ThemeCoordinatorContext)
  if (!context) {
    throw new Error('useThemeCoordinator must be used within a ThemeCoordinatorProvider')
  }
  return context
}
