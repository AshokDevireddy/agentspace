/**
 * Centralized query key definitions for TanStack Query
 * All query keys should be defined here to ensure consistency and easy invalidation
 */

/**
 * Creates a stable string representation of filter objects for query keys.
 * Ensures consistent cache key generation regardless of object reference equality.
 * This prevents cache bloat when filter objects are recreated on each render.
 */
function stableFilterKey(filters: Record<string, unknown> | undefined): string {
  if (!filters || Object.keys(filters).length === 0) {
    return ''
  }
  // Sort keys for deterministic output
  const sortedKeys = Object.keys(filters).sort()
  const normalized = sortedKeys.reduce<Record<string, unknown>>((acc, key) => {
    const value = filters[key]
    // Only include defined, non-null, non-empty values
    if (value !== undefined && value !== null && value !== '') {
      acc[key] = value
    }
    return acc
  }, {})

  return Object.keys(normalized).length > 0 ? JSON.stringify(normalized) : ''
}

export const queryKeys = {
  // Agents
  agents: ['agents'] as const,
  agentsList: (page: number, view: string, filters: Record<string, unknown>) =>
    ['agents', 'list', page, view, stableFilterKey(filters)] as const,
  agentDetail: (id: string) => ['agents', 'detail', id] as const,
  agentDownlines: (id: string) => ['agents', 'downlines', id] as const,
  agentsPendingPositions: () => ['agents', 'pending-positions'] as const,

  // Deals
  deals: ['deals'] as const,
  dealsList: (page: number, view: string, filters: Record<string, unknown>) =>
    ['deals', 'list', page, view, stableFilterKey(filters)] as const,
  dealDetail: (id: string) => ['deals', 'detail', id] as const,
  dealsFilterOptions: () => ['deals', 'filter-options'] as const,
  dealsBookOfBusiness: (filters?: Record<string, unknown>) =>
    ['deals', 'book-of-business', stableFilterKey(filters)] as const,

  // Clients
  clients: ['clients'] as const,
  clientsList: (page: number, filters: Record<string, unknown>) =>
    ['clients', 'list', page, stableFilterKey(filters)] as const,
  clientsAll: (viewMode: string) => ['clients', 'all', viewMode] as const,
  clientDetail: (id: string) => ['clients', 'detail', id] as const,

  // Conversations & Messages (SMS)
  conversations: ['conversations'] as const,
  conversationsList: (view: string, filters: Record<string, unknown>) =>
    ['conversations', 'list', view, stableFilterKey(filters)] as const,
  conversationDetail: (id: string) => ['conversations', 'detail', id] as const,
  conversationCount: (view: string) => ['conversations', 'count', view] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,

  // Drafts
  drafts: ['drafts'] as const,
  draftsList: (view?: string) => ['drafts', 'list', view] as const,

  // Positions
  positions: ['positions'] as const,
  positionsList: () => ['positions', 'list'] as const,
  positionsCheck: (userId: string) => ['positions', 'check', userId] as const,

  // Carriers
  carriers: ['carriers'] as const,
  carriersList: (filter?: string) => ['carriers', 'list', filter] as const,

  // User & Profile
  user: ['user'] as const,
  userProfile: (id?: string) => ['user', 'profile', id] as const,
  userSettings: () => ['user', 'settings'] as const,
  userAdminStatus: (id?: string) => ['user', 'admin-status', id] as const,
  userDefaultUpline: () => ['user', 'default-upline'] as const,

  // Scoreboard
  scoreboard: (userId: string, startDate: string, endDate: string) =>
    ['scoreboard', userId, startDate, endDate] as const,

  // Analytics
  analytics: ['analytics'] as const,
  analyticsData: (filters: Record<string, unknown>) =>
    ['analytics', 'data', stableFilterKey(filters)] as const,
  analyticsProduction: (filters: Record<string, unknown>) =>
    ['analytics', 'production', stableFilterKey(filters)] as const,
  analyticsDownlines: (filters: Record<string, unknown>) =>
    ['analytics', 'downlines', stableFilterKey(filters)] as const,

  // Downline Production
  downlineProduction: (agentId: string, timeWindow: string) =>
    ['downline-production', agentId, timeWindow] as const,

  // Policies
  policies: ['policies'] as const,
  policiesList: (page: number, filters: Record<string, unknown>) =>
    ['policies', 'list', page, stableFilterKey(filters)] as const,
  policyDetail: (id: string) => ['policies', 'detail', id] as const,
  policiesExpectedPayouts: (page: number, filters: Record<string, unknown>) =>
    ['policies', 'expected-payouts', page, stableFilterKey(filters)] as const,

  // Expected Payouts
  expectedPayouts: ['expected-payouts'] as const,
  expectedPayoutsData: (filters: Record<string, unknown>) =>
    ['expected-payouts', 'data', stableFilterKey(filters)] as const,
  expectedPayoutsDebt: (agentId: string) =>
    ['expected-payouts', 'debt', agentId] as const,

  // Configuration
  configuration: ['configuration'] as const,
  configurationTab: (tab: string) => ['configuration', tab] as const,
  configurationAgency: () => ['configuration', 'agency'] as const,
  configurationCarriers: () => ['configuration', 'carriers'] as const,
  configurationProducts: () => ['configuration', 'products'] as const,
  configurationPositions: () => ['configuration', 'positions'] as const,
  configurationCommissions: (carrierId?: string) =>
    ['configuration', 'commissions', carrierId] as const,
  configurationCarrierNames: () => ['configuration', 'carrier-names'] as const,
  configurationPolicyFiles: () => ['configuration', 'policy-files'] as const,

  // Subscriptions & Billing
  subscription: ['subscription'] as const,
  subscriptionStatus: () => ['subscription', 'status'] as const,

  // Search
  search: ['search'] as const,
  searchAgents: (query: string) => ['search', 'agents', query] as const,
  searchClients: (query: string) => ['search', 'clients', query] as const,
  searchUsers: (query: string) => ['search', 'users', query] as const,
  searchDeals: (name: string, phone: string) => ['search', 'deals', name, phone] as const,
  searchPreInviteUsers: (query: string) => ['search', 'pre-invite', query] as const,
  searchAsync: (endpoint: string, query: string) => ['search', 'async', endpoint, query] as const,

  // Notifications
  notifications: ['notifications'] as const,
  notificationsList: () => ['notifications', 'list'] as const,
  notificationsUnread: () => ['notifications', 'unread'] as const,

  // NIPR
  nipr: ['nipr'] as const,
  niprStatus: (userId: string) => ['nipr', 'status', userId] as const,
  niprJob: (jobId: string) => ['nipr', 'job', jobId] as const,

  // Agency
  agency: ['agency'] as const,
  agencyColor: (agencyId: string) => ['agency', 'color', agencyId] as const,
  agencyBranding: (agencyId: string | null) => ['agency', 'branding', agencyId] as const,
  agencyOptions: (userId: string) => ['agency', 'options', userId] as const,

  // Products
  products: ['products'] as const,
  productsByCarrier: (agencyId: string, carrierId: string) =>
    ['products', agencyId, carrierId] as const,

  // Policy Reports
  policyReports: ['policy-reports'] as const,
  policyReportsFiles: (agencyId: string) => ['policy-reports', 'files', agencyId] as const,
}

// Helper type for query key
export type QueryKeyType = ReturnType<typeof queryKeys[keyof typeof queryKeys]> | (typeof queryKeys)[keyof typeof queryKeys]
