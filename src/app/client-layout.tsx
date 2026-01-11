'use client'

import { usePathname } from 'next/navigation'
import Navigation from '@/components/navigation'
import OnboardingTour from '@/components/onboarding-tour'
import { Building2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useAgencyBranding } from '@/contexts/AgencyBrandingContext'
import { useAuth } from '@/providers/AuthProvider'

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
  const { userData, loading } = useAuth()
  const { branding, isWhiteLabel, loading: brandingLoading } = useAgencyBranding()
  const isAuthPage = AUTH_PAGES.includes(pathname)
  const isClientPage = CLIENT_PAGES.some(page => pathname.startsWith(page))

  // Get role and status from centralized auth state (no duplicate fetching)
  const userRole = userData?.role || null
  const userStatus = userData?.status || null

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

  // Show loading screen for protected pages while auth is initializing
  // This prevents race conditions where pages try to fetch data before auth is ready
  if (loading && !isAuthPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Determine if we should hide navigation
  // Hide for: client users OR users in onboarding wizard phase (status=onboarding AND on root path which shows wizard)
  const isOnWizardPath = pathname === '/' && userStatus === 'onboarding'
  const shouldHideNavigation = !loading && (userRole === 'client' || isOnWizardPath)

  // Client pages or wizard phase - no navigation sidebar
  if (isClientPage || shouldHideNavigation) {
    return (
      <div className="min-h-screen bg-background">
        {children}
        <OnboardingTour />
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
      <OnboardingTour />
    </div>
  )
}

