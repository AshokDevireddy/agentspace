/**
 * White-label utilities for detecting agency branding based on domain
 *
 * Note: Data fetching functions have been migrated to TanStack Query hooks.
 * See src/hooks/useUserQueries.ts for useAgencyBrandingByDomain() and useAgencyBranding()
 */

/**
 * Check if the current domain is a white-labeled domain
 * Returns false for default AgentSpace domains (main app, localhost, vercel previews)
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
