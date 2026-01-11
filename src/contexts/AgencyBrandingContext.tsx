"use client"

import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { useAgencyBrandingByDomain } from '@/hooks/useUserQueries'
import { isWhiteLabelDomain } from '@/lib/whitelabel'

interface AgencyBranding {
  id: string
  name: string
  display_name: string | null
  logo_url: string | null
  primary_color: string | null
  theme_mode: string | null
  whitelabel_domain: string | null
}

interface AgencyBrandingContextType {
  branding: AgencyBranding | null
  isWhiteLabel: boolean
  loading: boolean
}

const AgencyBrandingContext = createContext<AgencyBrandingContextType>({
  branding: null,
  isWhiteLabel: false,
  loading: true,
})

export function useAgencyBranding() {
  return useContext(AgencyBrandingContext)
}

// SSR-safe hostname detection using useSyncExternalStore
const hostnameSubscribe = () => () => {}
const getHostname = () => typeof window !== 'undefined' ? window.location.hostname : null
const getServerHostname = () => null

export function AgencyBrandingProvider({ children }: { children: React.ReactNode }) {
  // SSR-safe: returns null on server, actual hostname on client after hydration
  const hostname = useSyncExternalStore(hostnameSubscribe, getHostname, getServerHostname)

  // Determine if this is a white-label domain
  const isWhiteLabel = hostname ? isWhiteLabelDomain(hostname) : false

  // Use TanStack Query for fetching branding data
  const { data: branding, isLoading } = useAgencyBrandingByDomain(
    isWhiteLabel ? hostname : null,
    { enabled: isWhiteLabel && !!hostname }
  )

  // Loading is true until hostname is detected and (if whitelabel) data is loaded
  const loading = hostname === null || (isWhiteLabel && isLoading)

  const contextValue = useMemo(() => ({
    branding: branding || null,
    isWhiteLabel,
    loading,
  }), [branding, isWhiteLabel, loading])

  return (
    <AgencyBrandingContext.Provider value={contextValue}>
      {children}
    </AgencyBrandingContext.Provider>
  )
}
