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
  is_active: boolean
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