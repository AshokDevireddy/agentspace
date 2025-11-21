/**
 * White-label utilities for detecting and managing agency branding based on domain
 */

import { createClient } from '@/lib/supabase/client'

export interface AgencyBranding {
  id: string
  name: string
  display_name: string
  logo_url: string | null
  primary_color: string | null
  theme_mode: 'light' | 'dark' | 'system' | null
  whitelabel_domain: string | null
}

/**
 * Default AgentSpace branding configuration
 */
export const DEFAULT_BRANDING: Omit<AgencyBranding, 'id' | 'name' | 'whitelabel_domain'> = {
  display_name: 'AgentSpace',
  logo_url: null,
  primary_color: '0 0% 0%',
  theme_mode: 'system',
}

/**
 * Check if the current domain is a white-labeled domain
 */
export function isWhiteLabelDomain(hostname: string): boolean {
  const defaultDomains = [
    'app.useagentspace.com',
    'localhost',
    '127.0.0.1',
    'useagentspace.com',
    'www.useagentspace.com',
  ]

  return !defaultDomains.includes(hostname) &&
         !hostname.includes('vercel.app') &&
         !hostname.includes('localhost')
}

/**
 * Get agency branding by domain (client-side only)
 */
export async function getAgencyBrandingByDomain(domain: string): Promise<AgencyBranding | null> {
  try {
    console.log('[getAgencyBrandingByDomain] Querying for domain:', domain)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('agencies')
      .select(`
        id,
        name,
        display_name,
        logo_url,
        primary_color,
        theme_mode,
        whitelabel_domain
      `)
      .eq('whitelabel_domain', domain)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('[getAgencyBrandingByDomain] Error fetching agency branding:', error)
      console.error('[getAgencyBrandingByDomain] Error details:', JSON.stringify(error, null, 2))
      return null
    }

    console.log('[getAgencyBrandingByDomain] Query successful, data:', data)
    return data as AgencyBranding | null
  } catch (error) {
    console.error('[getAgencyBrandingByDomain] Unexpected error:', error)
    return null
  }
}

/**
 * Get agency branding by agency ID (client-side only)
 */
export async function getAgencyBrandingById(agencyId: string): Promise<AgencyBranding | null> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('agencies')
      .select(`
        id,
        name,
        display_name,
        logo_url,
        primary_color,
        theme_mode,
        whitelabel_domain
      `)
      .eq('id', agencyId)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('Error fetching agency branding by ID:', error)
      return null
    }

    return data as AgencyBranding | null
  } catch (error) {
    console.error('Unexpected error fetching agency branding by ID:', error)
    return null
  }
}
