/**
 * API Configuration for Django Backend
 *
 * Provides utilities for constructing API URLs based on the backend being used.
 * Feature flag cutover system (P2-022)
 */

/**
 * Get the Django API base URL
 */
export function getDjangoApiUrl(): string {
  return process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000'
}

/**
 * Get the full API endpoint URL
 *
 * @param path - The API path (e.g., '/api/auth/login')
 * @param useDjango - Whether to use Django backend
 * @returns Full URL for Django, relative path for Next.js
 */
export function getApiEndpoint(path: string, useDjango: boolean): string {
  if (useDjango) {
    return `${getDjangoApiUrl()}${path}`
  }
  // Relative URL for Next.js API routes
  return path
}

// ============================================================================
// Auth Endpoints
// ============================================================================

export const djangoAuthEndpoints = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  refresh: '/api/auth/refresh',
  session: '/api/auth/session',
  register: '/api/auth/register',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
  verifyInvite: '/api/auth/verify-invite',
  setupAccount: '/api/auth/setup-account',
} as const

// ============================================================================
// Dashboard Endpoints
// ============================================================================

export const djangoDashboardEndpoints = {
  summary: '/api/dashboard/summary',
  scoreboard: '/api/dashboard/scoreboard',
  production: '/api/dashboard/production',
} as const

// ============================================================================
// Agent Endpoints (P2-023 to P2-026)
// ============================================================================

export const djangoAgentEndpoints = {
  list: '/api/agents',
  detail: (id: string) => `/api/agents/${id}`,
  downlines: '/api/agents/downlines',
  withoutPositions: '/api/agents/without-positions',
  assignPosition: '/api/agents/assign-position',
  search: '/api/search-agents',
} as const

// ============================================================================
// Deal Endpoints (P2-027 to P2-028)
// ============================================================================

export const djangoDealEndpoints = {
  list: '/api/deals',
  detail: (id: string) => `/api/deals/${id}`,
  bookOfBusiness: '/api/deals/book-of-business',
  filterOptions: '/api/deals/filter-options',
  searchAgents: '/api/deals/search-agents',
  searchClients: '/api/deals/search-clients',
  searchPolicyNumbers: '/api/deals/search-policy-numbers',
} as const

// ============================================================================
// Carrier Endpoints (P2-030)
// ============================================================================

export const djangoCarrierEndpoints = {
  list: '/api/carriers',
  detail: (id: string) => `/api/carriers/${id}`,
  names: '/api/carriers/names',
  withProducts: '/api/carriers/with-products',
} as const

// ============================================================================
// Product Endpoints (P2-031)
// ============================================================================

export const djangoProductEndpoints = {
  list: '/api/products',
  detail: (id: string) => `/api/products/${id}`,
  all: '/api/products/all',
} as const

// ============================================================================
// Position Endpoints (P2-032)
// ============================================================================

export const djangoPositionEndpoints = {
  list: '/api/positions',
  detail: (id: string) => `/api/positions/${id}`,
  productCommissions: '/api/positions/product-commissions',
} as const

// ============================================================================
// SMS Endpoints (P2-033 to P2-035)
// ============================================================================

export const djangoSmsEndpoints = {
  conversations: '/api/sms/conversations',
  messages: '/api/sms/messages',
  drafts: '/api/sms/drafts',
  send: '/api/sms/send',
  draftsApprove: '/api/sms/drafts/approve',
  draftsReject: '/api/sms/drafts/reject',
} as const

// ============================================================================
// Payout Endpoints (P2-029)
// ============================================================================

export const djangoPayoutEndpoints = {
  expectedPayouts: '/api/expected-payouts',
  debt: '/api/expected-payouts/debt',
} as const

// ============================================================================
// Client Endpoints (P2-037)
// ============================================================================

export const djangoClientEndpoints = {
  list: '/api/clients',
  detail: (id: string) => `/api/clients/${id}`,
} as const

// ============================================================================
// Scoreboard Endpoints (P2-036)
// ============================================================================

export const djangoScoreboardEndpoints = {
  scoreboard: '/api/scoreboard',
} as const

// ============================================================================
// Search Endpoints (P2-038)
// ============================================================================

export const djangoSearchEndpoints = {
  agents: '/api/search-agents',
  clients: '/api/search-clients',
  policies: '/api/search-policies',
} as const

// ============================================================================
// Helper Functions
// ============================================================================

export function getDjangoAuthEndpoint(
  endpoint: keyof typeof djangoAuthEndpoints
): string {
  return `${getDjangoApiUrl()}${djangoAuthEndpoints[endpoint]}`
}

export function getDjangoDashboardEndpoint(
  endpoint: keyof typeof djangoDashboardEndpoints
): string {
  return `${getDjangoApiUrl()}${djangoDashboardEndpoints[endpoint]}`
}

export function getDjangoAgentEndpoint(
  endpoint: keyof typeof djangoAgentEndpoints,
  id?: string
): string {
  const ep = djangoAgentEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(id!) : ep
  return `${getDjangoApiUrl()}${path}`
}

export function getDjangoDealEndpoint(
  endpoint: keyof typeof djangoDealEndpoints,
  id?: string
): string {
  const ep = djangoDealEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(id!) : ep
  return `${getDjangoApiUrl()}${path}`
}

export function getDjangoCarrierEndpoint(
  endpoint: keyof typeof djangoCarrierEndpoints,
  id?: string
): string {
  const ep = djangoCarrierEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(id!) : ep
  return `${getDjangoApiUrl()}${path}`
}

export function getDjangoProductEndpoint(
  endpoint: keyof typeof djangoProductEndpoints,
  id?: string
): string {
  const ep = djangoProductEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(id!) : ep
  return `${getDjangoApiUrl()}${path}`
}

export function getDjangoPositionEndpoint(
  endpoint: keyof typeof djangoPositionEndpoints,
  id?: string
): string {
  const ep = djangoPositionEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(id!) : ep
  return `${getDjangoApiUrl()}${path}`
}

export function getDjangoSmsEndpoint(
  endpoint: keyof typeof djangoSmsEndpoints
): string {
  return `${getDjangoApiUrl()}${djangoSmsEndpoints[endpoint]}`
}

export function getDjangoPayoutEndpoint(
  endpoint: keyof typeof djangoPayoutEndpoints
): string {
  return `${getDjangoApiUrl()}${djangoPayoutEndpoints[endpoint]}`
}

export function getDjangoClientEndpoint(
  endpoint: keyof typeof djangoClientEndpoints,
  id?: string
): string {
  const ep = djangoClientEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(id!) : ep
  return `${getDjangoApiUrl()}${path}`
}

export function getDjangoScoreboardEndpoint(
  endpoint: keyof typeof djangoScoreboardEndpoints
): string {
  return `${getDjangoApiUrl()}${djangoScoreboardEndpoints[endpoint]}`
}

export function getDjangoSearchEndpoint(
  endpoint: keyof typeof djangoSearchEndpoints
): string {
  return `${getDjangoApiUrl()}${djangoSearchEndpoints[endpoint]}`
}
