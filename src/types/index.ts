export interface User {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  full_name: string
  phone_number: string | null
  role: string
  is_admin: boolean
  status: string
  position_id: string | null
  position_name: string | null
  position_level: number | null
  upline_id: string | null
  upline_name: string | null
  total_prod: string | null
  total_policies_sold: string | null
  created_at: string
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
  policy_number: string | null
  status: string | null
  status_standardized: string | null
  agent_id: string | null
  agent_name: string | null
  client_id: string | null
  client_name: string | null
  carrier_id: string | null
  carrier_name: string | null
  product_id: string | null
  product_name: string | null
  annual_premium: string | null
  monthly_premium: string | null
  policy_effective_date: string | null
  submission_date: string | null
  created_at: string
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
  agent_id: string
  agent_name: string
  position: string | null
  production: string
  deals_count: number
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
  entries: LeaderboardProducer[]
  user_rank: number | null
  user_production: string | null
}

// Deal Hierarchy Snapshot - matches backend DealHierarchySnapshotSerializer
export interface DealHierarchySnapshot {
  deal_id: string
  agent_id: string
  agent_name: string | null
  upline_id: string | null
  upline_name: string | null
  commission_percentage: string
  created_at: string
}

// Beneficiary - matches backend BeneficiarySerializer
export interface Beneficiary {
  id: string
  deal_id: string
  agency_id: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  relationship: string | null
}

// Agent Carrier Number - matches backend AgentCarrierNumberSerializer
export interface AgentCarrierNumber {
  id: string
  agent_id: string
  agent_name: string | null
  carrier_id: string
  carrier_name: string | null
  agency_id: string
  agent_number: string
  is_active: boolean | null
  notes: string | null
  loa: string | null
  start_date: string | null
  created_at: string
  updated_at: string
}

// Status Mapping - matches backend StatusMappingSerializer
export interface StatusMapping {
  id: string
  carrier_id: string
  carrier_name: string
  raw_status: string
  standardized_status: string | null
  impact: 'positive' | 'negative' | 'neutral'
  placement: string | null
  created_at: string
  updated_at: string
}

// AI Types - matches backend AI serializers
export interface AIConversation {
  id: string
  user_id: string
  agency_id: string
  title: string | null
  message_count?: number
  created_at: string
  updated_at: string
}

export interface AIMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tool_calls: Record<string, unknown> | null
  chart_code: string | null
  chart_data: Record<string, unknown> | null
  tokens_used: number | null
  created_at: string
}