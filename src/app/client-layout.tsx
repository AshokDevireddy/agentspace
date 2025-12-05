'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navigation from '@/components/navigation'
import { Building2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import { useAgencyBranding } from '@/contexts/AgencyBrandingContext'

// Pages that should not show the navigation sidebar
const AUTH_PAGES = [
  '/login',
  '/register',
  '/setup-account',
  '/forgot-password',
  '/reset-password',
  '/auth/confirm',
  '/unauthorized'
]

// Pages for client users (no navigation)
const CLIENT_PAGES = ['/client/dashboard']

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const { branding, isWhiteLabel, loading: brandingLoading } = useAgencyBranding()
  const isAuthPage = AUTH_PAGES.includes(pathname)
  const isClientPage = CLIENT_PAGES.some(page => pathname.startsWith(page))
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Apply agency theme on authenticated pages (non-auth pages)
  useEffect(() => {
    const applyAgencyTheme = async () => {
      // Skip if on auth pages - let auth pages handle their own theme
      if (isAuthPage) return

      // Skip if branding is still loading
      if (brandingLoading) return

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Get user's agency ID
        const { data: userData } = await supabase
          .from('users')
          .select('agency_id')
          .eq('auth_user_id', user.id)
          .single()

        if (userData?.agency_id) {
          // Get agency theme preference
          const { data: agencyInfo } = await supabase
            .from('agencies')
            .select('theme_mode')
            .eq('id', userData.agency_id)
            .single()

          if (agencyInfo?.theme_mode) {
            // Apply agency theme
            setTheme(agencyInfo.theme_mode)
          } else {
            // Default to system if no theme preference set
            setTheme('system')
          }
        }
      }
    }

    applyAgencyTheme()
  }, [isAuthPage, pathname, brandingLoading, setTheme])

  useEffect(() => {
    const checkUserRole = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('auth_user_id', user.id)
          .single()

        setUserRole(userData?.role || null)
      }
      setLoading(false)
    }

    if (!isAuthPage) {
      checkUserRole()
    } else {
      setLoading(false)
    }
  }, [pathname, isAuthPage])

  // On auth pages, show a simple layout with just the logo
  if (isAuthPage) {
    // Determine display based on white-label status
    const displayName = isWhiteLabel && branding ? branding.display_name : 'AgentSpace'
    const logoUrl = isWhiteLabel && branding ? branding.logo_url : null

    return (
      <div className="min-h-screen bg-background">
        {/* Simple header with logo for auth pages */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
          <div className="container mx-auto px-4 py-4">
            {brandingLoading ? (
              // Loading skeleton
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
                <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              </div>
            ) : (
              <Link href="/" className="flex items-center space-x-3">
                {logoUrl ? (
                  <>
                    <img
                      src={logoUrl}
                      alt={`${displayName} logo`}
                      className="h-10 object-contain"
                    />
                    <span className="text-lg font-bold text-foreground" style={{ fontFamily: 'Times New Roman, serif' }}>{displayName}</span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-foreground text-background font-bold text-lg">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <span className="text-lg font-bold text-foreground" style={{ fontFamily: 'Times New Roman, serif' }}>{displayName}</span>
                  </>
                )}
              </Link>
            )}
          </div>
        </div>

        {/* Content with top padding to account for fixed header */}
        <main className="pt-20">
          {children}
        </main>
      </div>
    )
  }

  // Determine if we should hide navigation (only for confirmed client users)
  const shouldHideNavigation = !loading && userRole === 'client'

  // Client pages - no navigation sidebar
  if (isClientPage || shouldHideNavigation) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    )
  }

  // Regular authenticated pages with sidebar navigation (for agents, admins, and while loading)
  return (
    <div className="min-h-screen bg-background lg:pl-64 overflow-x-hidden">
      <Navigation />
      <main className="min-h-screen bg-background">
        <div className="p-4 lg:p-6 space-y-6">
          {children}
        </div>
      </main>
    </div>
  )
}

