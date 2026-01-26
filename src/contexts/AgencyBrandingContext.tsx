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

// Initial agency data from Django session (optional)
interface InitialAgencyData {
  display_name: string | null
  whitelabel_domain: string | null
  logo_url: string | null
}

interface AgencyBrandingProviderProps {
  children: React.ReactNode
  initialAgency?: InitialAgencyData | null
}

export function AgencyBrandingProvider({ children, initialAgency }: AgencyBrandingProviderProps) {
  // SSR-safe: returns null on server, actual hostname on client after hydration
  const hostname = useSyncExternalStore(hostnameSubscribe, getHostname, getServerHostname)

  // Determine if this is a white-label domain
  const isWhiteLabel = hostname ? isWhiteLabelDomain(hostname) : false

  // Use TanStack Query for fetching branding data (only if we don't have initial data)
  const { data: fetchedBranding, isLoading } = useAgencyBrandingByDomain(
    isWhiteLabel ? hostname : null,
    { enabled: isWhiteLabel && !!hostname && !initialAgency?.whitelabel_domain }
  )

  // Use fetched branding or construct from initialAgency
  const branding: AgencyBranding | null = useMemo(() => {
    if (fetchedBranding) {
      return fetchedBranding
    }
    if (initialAgency?.whitelabel_domain) {
      // Partial branding from Django session
      return {
        id: '',  // Not available from session
        name: initialAgency.display_name || '',
        display_name: initialAgency.display_name,
        logo_url: initialAgency.logo_url,
        primary_color: null,  // Not available from session
        theme_mode: null,  // Not available from session
        whitelabel_domain: initialAgency.whitelabel_domain,
      }
    }
    return null
  }, [fetchedBranding, initialAgency])

  // Loading is true until hostname is detected and (if whitelabel) data is loaded
  // If we have initialAgency data, we're not loading
  const loading = hostname === null ||
    (isWhiteLabel && isLoading && !initialAgency?.whitelabel_domain)

  const contextValue = useMemo(() => ({
    branding,
    isWhiteLabel,
    loading,
  }), [branding, isWhiteLabel, loading])

  return (
    <AgencyBrandingContext.Provider value={contextValue}>
      {children}
    </AgencyBrandingContext.Provider>
  )
}
