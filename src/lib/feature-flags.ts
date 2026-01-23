/**
 * Feature Flags for Django Backend Migration
 *
 * Controls gradual rollout of Django backend endpoints.
 * Uses environment variables for static config.
 * Feature flag cutover system (P2-022)
 */

export enum FeatureFlags {
  // Auth - permanently enabled, master flag kept for reference
  USE_DJANGO_AUTH = 'use_django_auth',

  // Dashboard endpoints
  USE_DJANGO_DASHBOARD = 'use_django_dashboard',
  USE_DJANGO_DASHBOARD_SUMMARY = 'use_django_dashboard_summary',
  USE_DJANGO_DASHBOARD_SCOREBOARD = 'use_django_dashboard_scoreboard',

  // Agent endpoints (P2-023 to P2-026)
  USE_DJANGO_AGENTS = 'use_django_agents',
  USE_DJANGO_AGENTS_LIST = 'use_django_agents_list',
  USE_DJANGO_AGENTS_DOWNLINES = 'use_django_agents_downlines',
  USE_DJANGO_AGENTS_WITHOUT_POSITIONS = 'use_django_agents_without_positions',
  USE_DJANGO_SEARCH_AGENTS = 'use_django_search_agents',

  // Deal endpoints (P2-027 to P2-028)
  USE_DJANGO_DEALS = 'use_django_deals',
  USE_DJANGO_DEALS_BOB = 'use_django_deals_bob',
  USE_DJANGO_DEALS_FILTERS = 'use_django_deals_filters',

  // Other read endpoints (P2-029 to P2-039)
  USE_DJANGO_CARRIERS = 'use_django_carriers',
  USE_DJANGO_PRODUCTS = 'use_django_products',
  USE_DJANGO_POSITIONS = 'use_django_positions',
  USE_DJANGO_PAYOUTS = 'use_django_payouts',
  USE_DJANGO_SMS = 'use_django_sms',
  USE_DJANGO_CLIENTS = 'use_django_clients',
  USE_DJANGO_SCOREBOARD = 'use_django_scoreboard',
  USE_DJANGO_SEARCH = 'use_django_search',
  USE_DJANGO_ANALYTICS = 'use_django_analytics',
}

/**
 * Environment variable mapping for feature flags
 */
const ENV_VAR_MAP: Record<FeatureFlags, string> = {
  [FeatureFlags.USE_DJANGO_AUTH]: 'NEXT_PUBLIC_DJANGO_AUTH_ENABLED',
  [FeatureFlags.USE_DJANGO_DASHBOARD]: 'NEXT_PUBLIC_DJANGO_DASHBOARD_ENABLED',
  [FeatureFlags.USE_DJANGO_DASHBOARD_SUMMARY]: 'NEXT_PUBLIC_DJANGO_DASHBOARD_SUMMARY_ENABLED',
  [FeatureFlags.USE_DJANGO_DASHBOARD_SCOREBOARD]: 'NEXT_PUBLIC_DJANGO_DASHBOARD_SCOREBOARD_ENABLED',
  [FeatureFlags.USE_DJANGO_AGENTS]: 'NEXT_PUBLIC_DJANGO_AGENTS_ENABLED',
  [FeatureFlags.USE_DJANGO_AGENTS_LIST]: 'NEXT_PUBLIC_DJANGO_AGENTS_LIST_ENABLED',
  [FeatureFlags.USE_DJANGO_AGENTS_DOWNLINES]: 'NEXT_PUBLIC_DJANGO_AGENTS_DOWNLINES_ENABLED',
  [FeatureFlags.USE_DJANGO_AGENTS_WITHOUT_POSITIONS]: 'NEXT_PUBLIC_DJANGO_AGENTS_WITHOUT_POSITIONS_ENABLED',
  [FeatureFlags.USE_DJANGO_SEARCH_AGENTS]: 'NEXT_PUBLIC_DJANGO_SEARCH_AGENTS_ENABLED',
  [FeatureFlags.USE_DJANGO_DEALS]: 'NEXT_PUBLIC_DJANGO_DEALS_ENABLED',
  [FeatureFlags.USE_DJANGO_DEALS_BOB]: 'NEXT_PUBLIC_DJANGO_DEALS_BOB_ENABLED',
  [FeatureFlags.USE_DJANGO_DEALS_FILTERS]: 'NEXT_PUBLIC_DJANGO_DEALS_FILTERS_ENABLED',
  [FeatureFlags.USE_DJANGO_CARRIERS]: 'NEXT_PUBLIC_DJANGO_CARRIERS_ENABLED',
  [FeatureFlags.USE_DJANGO_PRODUCTS]: 'NEXT_PUBLIC_DJANGO_PRODUCTS_ENABLED',
  [FeatureFlags.USE_DJANGO_POSITIONS]: 'NEXT_PUBLIC_DJANGO_POSITIONS_ENABLED',
  [FeatureFlags.USE_DJANGO_PAYOUTS]: 'NEXT_PUBLIC_DJANGO_PAYOUTS_ENABLED',
  [FeatureFlags.USE_DJANGO_SMS]: 'NEXT_PUBLIC_DJANGO_SMS_ENABLED',
  [FeatureFlags.USE_DJANGO_CLIENTS]: 'NEXT_PUBLIC_DJANGO_CLIENTS_ENABLED',
  [FeatureFlags.USE_DJANGO_SCOREBOARD]: 'NEXT_PUBLIC_DJANGO_SCOREBOARD_ENABLED',
  [FeatureFlags.USE_DJANGO_SEARCH]: 'NEXT_PUBLIC_DJANGO_SEARCH_ENABLED',
  [FeatureFlags.USE_DJANGO_ANALYTICS]: 'NEXT_PUBLIC_DJANGO_ANALYTICS_ENABLED',
}

/**
 * Parent flag relationships (child inherits from parent unless explicitly set)
 */
const PARENT_FLAGS: Partial<Record<FeatureFlags, FeatureFlags>> = {
  [FeatureFlags.USE_DJANGO_DASHBOARD_SUMMARY]: FeatureFlags.USE_DJANGO_DASHBOARD,
  [FeatureFlags.USE_DJANGO_DASHBOARD_SCOREBOARD]: FeatureFlags.USE_DJANGO_DASHBOARD,
  [FeatureFlags.USE_DJANGO_AGENTS_LIST]: FeatureFlags.USE_DJANGO_AGENTS,
  [FeatureFlags.USE_DJANGO_AGENTS_DOWNLINES]: FeatureFlags.USE_DJANGO_AGENTS,
  [FeatureFlags.USE_DJANGO_AGENTS_WITHOUT_POSITIONS]: FeatureFlags.USE_DJANGO_AGENTS,
  [FeatureFlags.USE_DJANGO_SEARCH_AGENTS]: FeatureFlags.USE_DJANGO_AGENTS,
  [FeatureFlags.USE_DJANGO_DEALS_BOB]: FeatureFlags.USE_DJANGO_DEALS,
  [FeatureFlags.USE_DJANGO_DEALS_FILTERS]: FeatureFlags.USE_DJANGO_DEALS,
}

/**
 * Check if a feature flag is enabled.
 * Supports hierarchical flags (child inherits from parent).
 */
export function isFeatureEnabled(flag: FeatureFlags): boolean {
  // Master switch - if Django backend is disabled, all flags are off
  if (process.env.NEXT_PUBLIC_USE_DJANGO_BACKEND !== 'true') {
    return false
  }

  const envVar = ENV_VAR_MAP[flag]
  const envValue = process.env[envVar]

  // If explicitly set, use that value
  if (envValue === 'true') return true
  if (envValue === 'false') return false

  // Check parent flag if exists
  const parentFlag = PARENT_FLAGS[flag]
  if (parentFlag) {
    return isFeatureEnabled(parentFlag)
  }

  // Default to false (opt-in)
  return false
}

/**
 * Get all feature flag statuses
 */
export function getAllFeatureFlags(): Record<FeatureFlags, boolean> {
  const result = {} as Record<FeatureFlags, boolean>
  for (const flag of Object.values(FeatureFlags)) {
    result[flag] = isFeatureEnabled(flag)
  }
  return result
}

// ============================================================================
// Convenience functions for specific endpoints
// ============================================================================

// Auth - permanently using Django
export function shouldUseDjangoAuth(): boolean {
  return true // Permanently using Django auth
}

// Dashboard
export function shouldUseDjangoDashboard(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_DASHBOARD)
}

// Agents (P2-023 to P2-026)
export function shouldUseDjangoAgents(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_AGENTS)
}

export function shouldUseDjangoAgentsList(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_AGENTS_LIST)
}

export function shouldUseDjangoAgentsDownlines(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_AGENTS_DOWNLINES)
}

export function shouldUseDjangoAgentsWithoutPositions(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_AGENTS_WITHOUT_POSITIONS)
}

export function shouldUseDjangoSearchAgents(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_SEARCH_AGENTS)
}

// Deals (P2-027 to P2-028)
export function shouldUseDjangoDeals(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_DEALS)
}

export function shouldUseDjangoDealsBob(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_DEALS_BOB)
}

export function shouldUseDjangoDealsFilters(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_DEALS_FILTERS)
}

// Other endpoints (P2-029 to P2-039)
export function shouldUseDjangoCarriers(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_CARRIERS)
}

export function shouldUseDjangoProducts(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_PRODUCTS)
}

export function shouldUseDjangoPositions(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_POSITIONS)
}

export function shouldUseDjangoPayouts(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_PAYOUTS)
}

export function shouldUseDjangoSms(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_SMS)
}

export function shouldUseDjangoClients(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_CLIENTS)
}

export function shouldUseDjangoScoreboard(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_SCOREBOARD)
}

export function shouldUseDjangoSearch(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_SEARCH)
}

export function shouldUseDjangoAnalytics(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_ANALYTICS)
}
