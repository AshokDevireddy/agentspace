'use client'

import { usePathname } from 'next/navigation'
import Navigation from '@/components/navigation'
import { Building2 } from 'lucide-react'
import Link from 'next/link'

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

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isAuthPage = AUTH_PAGES.includes(pathname)

  // On auth pages, show a simple layout with just the logo
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-background">
        {/* Simple header with logo for auth pages */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <Link href="/" className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-lg">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-foreground">AgentView</span>
                <span className="text-xs text-muted-foreground">CRM Platform</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Content with top padding to account for fixed header */}
        <main className="pt-20">
          {children}
        </main>
      </div>
    )
  }

  // Regular authenticated pages with sidebar navigation
  return (
    <div className="flex min-h-screen bg-background">
      <Navigation />
      <main className="flex-1 lg:ml-64 min-h-screen bg-background">
        <div className="p-4 lg:p-6 space-y-6">
          {children}
        </div>
      </main>
    </div>
  )
}

