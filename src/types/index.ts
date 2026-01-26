export interface User {
  id: string
  email: string
  full_name: string
  position_id?: string
  upline_id?: string
  created_at: string
  updated_at: string
}

export interface Position {
  id: string
  name: string
  level: number
  created_at: string
}

export interface Agent {
  id: string
  user_id: string
  position_id: string
  upline_id?: string
  start_date: string
  status: 'pre-invite' | 'invited' | 'onboarding' | 'active' | 'inactive'
  created_at: string
  updated_at: string
  user?: User
  position?: Position
  upline?: Agent
  downlines?: Agent[]
}

export interface Deal {
  id: string
  agent_id: string
  carrier: string
  product: string
  client_name: string
  client_phone: string
  policy_number?: string
  application_number?: string
  monthly_premium: number
  annual_premium: number
  policy_effective_date: string
  split_agent_id?: string
  split_percentage?: number
  referral_count: number
  lead_source: 'referral' | 'provided' | 'purchased' | 'no-lead'
  status: 'draft' | 'submitted' | 'pending' | 'active' | 'terminated'
  created_at: string
  updated_at: string
  agent?: Agent
  split_agent?: Agent
}

export interface Commission {
  id: string
  deal_id: string
  agent_id: string
  amount: number
  percentage: number
  commission_type: 'initial' | 'renewal' | 'bonus'
  payment_date?: string
  status: 'pending' | 'paid' | 'cancelled'
  created_at: string
  deal?: Deal
  agent?: Agent
}

export interface CommissionReport {
  id: string
  loa_contract: string
  agent_payroll: string
  date: string
  amount: number
  payment_identifier: string
  file_url?: string
  lead_fee_percentage: number
  status: 'pending' | 'processed' | 'error'
  created_at: string
  updated_at: string
}

// Available positions from the dropdown
export const POSITIONS = [
  'Legacy Managing Partner',
  'Legacy Senior Partner',
  'Legacy Junior Partner',
  'Karma Partner',
  'Karma Director 2',
  'Karma Director 1',
  'Legacy MGA',
  'Legacy GA',
  'Legacy SA',
  'Managing General Agent 2',
  'Managing General Agent 1',
  'Legacy BA',
  'General Agent 2',
  'General Agent 1',
  'Supervising Agent 2',
  'Supervising Agent 1',
  'Brokerage Agent',
  'Legacy Prodigy',
  'Prodigy',
  'Junior Prodigy',
  'Conservation Manager',
  'Conservation Agent',
  'Prodigy Manager'
] as const

export type PositionType = typeof POSITIONS[number]

// Dashboard and Analytics Types
export interface CarrierActive {
  carrier: string
  active_policies: number
}

export interface PieChartEntry {
  name: string
  value: number
  percentage: string
  fill: string
  showLabel: boolean
  isOthers?: boolean
  originalCarriers?: Array<{
    name: string
    value: number
    percentage: string
  }>
}

export interface LeaderboardProducer {
  rank: number
  name: string
  total: number
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}

export interface UserProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'admin' | 'agent' | 'client'
  is_admin: boolean
  status: 'pre-invite' | 'invited' | 'onboarding' | 'active' | 'inactive'
  agency_id: string
  position_id?: string
  upline_id?: string
}

export interface DealsSummary {
  active_policies: number
  total_clients: number
  carriers_active: CarrierActive[]
  monthly_commissions?: number
  new_policies?: number
}

export interface DashboardData {
  your_deals?: DealsSummary
  downline_production?: DealsSummary
  totals?: {
    pending_positions?: number
  }
  pending_positions?: number
  active_policies?: number
  total_clients?: number
  carriers_active?: CarrierActive[]
}

export interface ScoreboardData {
  dateRange: {
    startDate: string
    endDate: string
  }
  leaderboard?: LeaderboardProducer[]
}