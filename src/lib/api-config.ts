/**
 * API Configuration
 *
 * Provides utilities for constructing API URLs.
 */

/**
 * Get the API base URL
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}

// ============================================================================
// Auth Endpoints
// ============================================================================

export const authEndpoints = {
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

export const dashboardEndpoints = {
  summary: '/api/dashboard/summary',
  scoreboard: '/api/dashboard/scoreboard',
  scoreboardLapsed: '/api/dashboard/scoreboard-lapsed',
  scoreboardBillingCycle: '/api/dashboard/scoreboard-billing-cycle',
  production: '/api/dashboard/production',
} as const

// ============================================================================
// Agent Endpoints
// ============================================================================

export const agentEndpoints = {
  list: '/api/agents',
  detail: (id: string) => `/api/agents/${id}`,
  downlines: '/api/agents/downlines',
  withoutPositions: '/api/agents/without-positions',
  assignPosition: '/api/agents/assign-position',
  search: '/api/search-agents',
} as const

// ============================================================================
// Deal Endpoints
// ============================================================================

export const dealEndpoints = {
  list: '/api/deals',
  detail: (id: string) => `/api/deals/${id}`,
  bookOfBusiness: '/api/deals/book-of-business',
  filterOptions: '/api/deals/filter-options',
  searchAgents: '/api/deals/search-agents',
  searchClients: '/api/deals/search-clients',
  searchPolicyNumbers: '/api/deals/search-policy-numbers',
} as const

// ============================================================================
// Carrier Endpoints
// ============================================================================

export const carrierEndpoints = {
  list: '/api/carriers',
  detail: (id: string) => `/api/carriers/${id}`,
  names: '/api/carriers/names',
  withProducts: '/api/carriers/with-products',
} as const

// ============================================================================
// Product Endpoints
// ============================================================================

export const productEndpoints = {
  list: '/api/products',
  detail: (id: string) => `/api/products/${id}`,
  all: '/api/products/all',
} as const

// ============================================================================
// Position Endpoints
// ============================================================================

export const positionEndpoints = {
  list: '/api/positions',
  detail: (id: string) => `/api/positions/${id}`,
  productCommissions: '/api/positions/product-commissions',
} as const

// ============================================================================
// SMS Endpoints
// ============================================================================

export const smsEndpoints = {
  conversations: '/api/sms/conversations',
  messages: '/api/sms/messages',
  drafts: '/api/sms/drafts',
  send: '/api/sms/send',
  draftsApprove: '/api/sms/drafts/approve',
  draftsReject: '/api/sms/drafts/reject',
} as const

// ============================================================================
// Payout Endpoints
// ============================================================================

export const payoutEndpoints = {
  expectedPayouts: '/api/expected-payouts',
  debt: '/api/expected-payouts/debt',
} as const

// ============================================================================
// Client Endpoints
// ============================================================================

export const clientEndpoints = {
  list: '/api/clients',
  detail: (id: string) => `/api/clients/${id}`,
} as const

// ============================================================================
// Scoreboard Endpoints
// ============================================================================

export const scoreboardEndpoints = {
  scoreboard: '/api/scoreboard',
} as const

// ============================================================================
// Search Endpoints
// ============================================================================

export const searchEndpoints = {
  agents: '/api/search-agents',
  clients: '/api/search-clients',
  policies: '/api/search-policies',
} as const

// ============================================================================
// Analytics Endpoints
// ============================================================================

export const analyticsEndpoints = {
  split: '/api/analytics/split-view',
  downlineDistribution: '/api/analytics/downline-distribution',
  deals: '/api/analytics/deals',
  persistency: '/api/analytics/persistency',
} as const

// ============================================================================
// Onboarding Endpoints
// ============================================================================

export const onboardingEndpoints = {
  progress: '/api/onboarding/progress',
  complete: '/api/onboarding/complete',
  invitations: '/api/onboarding/invitations',
  invitationsSend: '/api/onboarding/invitations/send',
  invitationDelete: (index: number) => `/api/onboarding/invitations/${index}`,
} as const

// ============================================================================
// Messaging Endpoints (Cron jobs)
// ============================================================================

export const messagingEndpoints = {
  billingReminders: '/api/messaging/billing-reminders',
  birthdays: '/api/messaging/birthdays',
  holidays: '/api/messaging/holidays',
  lapseReminders: '/api/messaging/lapse-reminders',
  needsInfo: '/api/messaging/needs-info',
  policyCheckups: '/api/messaging/policy-checkups',
  quarterlyCheckins: '/api/messaging/quarterly-checkins',
} as const

// ============================================================================
// NIPR Endpoints
// ============================================================================

export const niprEndpoints = {
  acquireJob: '/api/nipr/acquire-job',
  completeJob: '/api/nipr/complete-job',
  jobProgress: '/api/nipr/job-progress',
  releaseLocks: '/api/nipr/release-locks',
  jobStatus: (jobId: string) => `/api/nipr/job/${jobId}`,
} as const

// ============================================================================
// Ingest Endpoints
// ============================================================================

export const ingestEndpoints = {
  enqueueJob: '/api/ingest/enqueue-job',
  orchestrate: '/api/ingest/orchestrate',
  syncStaging: '/api/ingest/sync-staging',
  stagingSummary: '/api/ingest/staging-summary',
  createClientsFromDeals: '/api/ingest/create-clients-from-deals',
  createClientsFromStaging: '/api/ingest/create-clients-from-staging',
  createUsersFromStaging: '/api/ingest/create-users-from-staging',
  createProductsFromStaging: '/api/ingest/create-products-from-staging',
  createWritingAgentNumbers: '/api/ingest/create-writing-agent-numbers',
  dedupeStaging: '/api/ingest/dedupe-staging',
} as const

// ============================================================================
// Helper Functions
// ============================================================================

export function getAuthEndpoint(
  endpoint: keyof typeof authEndpoints
): string {
  return `${getApiBaseUrl()}${authEndpoints[endpoint]}`
}

export function getDashboardEndpoint(
  endpoint: keyof typeof dashboardEndpoints
): string {
  return `${getApiBaseUrl()}${dashboardEndpoints[endpoint]}`
}

export function getAgentEndpoint(
  endpoint: keyof typeof agentEndpoints,
  id?: string
): string {
  const ep = agentEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(id!) : ep
  return `${getApiBaseUrl()}${path}`
}

export function getDealEndpoint(
  endpoint: keyof typeof dealEndpoints,
  id?: string
): string {
  const ep = dealEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(id!) : ep
  return `${getApiBaseUrl()}${path}`
}

export function getCarrierEndpoint(
  endpoint: keyof typeof carrierEndpoints,
  id?: string
): string {
  const ep = carrierEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(id!) : ep
  return `${getApiBaseUrl()}${path}`
}

export function getProductEndpoint(
  endpoint: keyof typeof productEndpoints,
  id?: string
): string {
  const ep = productEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(id!) : ep
  return `${getApiBaseUrl()}${path}`
}

export function getPositionEndpoint(
  endpoint: keyof typeof positionEndpoints,
  id?: string
): string {
  const ep = positionEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(id!) : ep
  return `${getApiBaseUrl()}${path}`
}

export function getSmsEndpoint(
  endpoint: keyof typeof smsEndpoints
): string {
  return `${getApiBaseUrl()}${smsEndpoints[endpoint]}`
}

export function getPayoutEndpoint(
  endpoint: keyof typeof payoutEndpoints
): string {
  return `${getApiBaseUrl()}${payoutEndpoints[endpoint]}`
}

export function getClientEndpoint(
  endpoint: keyof typeof clientEndpoints,
  id?: string
): string {
  const ep = clientEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(id!) : ep
  return `${getApiBaseUrl()}${path}`
}

export function getScoreboardEndpoint(
  endpoint: keyof typeof scoreboardEndpoints
): string {
  return `${getApiBaseUrl()}${scoreboardEndpoints[endpoint]}`
}

export function getSearchEndpoint(
  endpoint: keyof typeof searchEndpoints
): string {
  return `${getApiBaseUrl()}${searchEndpoints[endpoint]}`
}

export function getAnalyticsEndpoint(
  endpoint: keyof typeof analyticsEndpoints
): string {
  return `${getApiBaseUrl()}${analyticsEndpoints[endpoint]}`
}

export function getOnboardingEndpoint(
  endpoint: keyof typeof onboardingEndpoints,
  index?: number
): string {
  const ep = onboardingEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(index!) : ep
  return `${getApiBaseUrl()}${path}`
}

export function getMessagingEndpoint(
  endpoint: keyof typeof messagingEndpoints
): string {
  return `${getApiBaseUrl()}${messagingEndpoints[endpoint]}`
}

export function getNiprEndpoint(
  endpoint: keyof typeof niprEndpoints,
  jobId?: string
): string {
  const ep = niprEndpoints[endpoint]
  const path = typeof ep === 'function' ? ep(jobId!) : ep
  return `${getApiBaseUrl()}${path}`
}

export function getIngestEndpoint(
  endpoint: keyof typeof ingestEndpoints
): string {
  return `${getApiBaseUrl()}${ingestEndpoints[endpoint]}`
}

