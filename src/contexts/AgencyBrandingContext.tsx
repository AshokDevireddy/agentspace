"use client"

import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { useAgencyBrandingByDomain } from '@/hooks/useUserQueries'
import { isWhiteLabelDomain } from '@/lib/whitelabel'

interface AgencyBranding {
  id: string
  name: string
  displayName: string | null
  logoUrl: string | null
  primaryColor: string | null
  themeMode: string | null
  whitelabelDomain: string | null
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
  displayName: string | null
  whitelabelDomain: string | null
  logoUrl: string | null
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
    { enabled: isWhiteLabel && !!hostname && !initialAgency?.whitelabelDomain }
  )

  // Use fetched branding or construct from initialAgency
  const branding: AgencyBranding | null = useMemo(() => {
    if (fetchedBranding) {
      return fetchedBranding
    }
    if (initialAgency?.whitelabelDomain) {
      // Partial branding from Django session
      return {
        id: '',  // Not available from session
        name: initialAgency.displayName || '',
        displayName: initialAgency.displayName,
        logoUrl: initialAgency.logoUrl,
        primaryColor: null,  // Not available from session
        themeMode: null,  // Not available from session
        whitelabelDomain: initialAgency.whitelabelDomain,
      }
    }
    return null
  }, [fetchedBranding, initialAgency])

  // Loading is true until hostname is detected and (if whitelabel) data is loaded
  // If we have initialAgency data, we're not loading
  const loading = hostname === null ||
    (isWhiteLabel && isLoading && !initialAgency?.whitelabelDomain)

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
