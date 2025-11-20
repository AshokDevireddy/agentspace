"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { AgencyBranding, getAgencyBrandingByDomain, isWhiteLabelDomain, DEFAULT_BRANDING } from '@/lib/whitelabel'

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

export function AgencyBrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<AgencyBranding | null>(null)
  const [isWhiteLabel, setIsWhiteLabel] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadBranding() {
      try {
        const hostname = window.location.hostname
        const isWL = isWhiteLabelDomain(hostname)
        setIsWhiteLabel(isWL)

        if (isWL) {
          // Fetch agency branding for white-labeled domain
          const agencyBranding = await getAgencyBrandingByDomain(hostname)
          setBranding(agencyBranding)
        } else {
          // Use default AgentSpace branding
          setBranding(null)
        }
      } catch (error) {
        console.error('Error loading agency branding:', error)
        setBranding(null)
      } finally {
        setLoading(false)
      }
    }

    loadBranding()
  }, [])

  return (
    <AgencyBrandingContext.Provider value={{ branding, isWhiteLabel, loading }}>
      {children}
    </AgencyBrandingContext.Provider>
  )
}
