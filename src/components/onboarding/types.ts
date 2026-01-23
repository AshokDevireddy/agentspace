/**
 * Onboarding Types
 *
 * Shared type definitions for the modular onboarding wizard.
 */

export interface UserData {
  id: string
  first_name: string
  last_name: string
  email: string
  role: 'admin' | 'agent' | 'client'
  is_admin: boolean
  agency_id?: string
}

export interface InvitedAgent {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  permissionLevel: string
  uplineAgentId: string | null
  preInviteUserId?: string | null
}

export interface AgentSearchResult {
  id: string
  first_name: string
  last_name: string
  email: string
  status?: string
}

export interface SearchOption {
  value: string
  label: string
  status?: string
}

export interface NiprForm {
  lastName: string
  npn: string
  ssn: string
  dob: string
}

export interface NiprAnalysis {
  success: boolean
  carriers: string[]
  unique_carriers?: string[]
  licensedStates: { resident: string[]; nonResident: string[] }
  analyzedAt: string
}

export interface NiprResult {
  success: boolean
  message: string
  files?: string[]
  analysis?: NiprAnalysis
}

export type OnboardingStep = 'nipr_verification' | 'team_invitation' | 'completed'
export type NiprMode = 'upload' | 'automation'
export type NiprStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface OnboardingContext {
  userData: UserData
  currentStep: number
  setCurrentStep: (step: number) => void
  errors: string[]
  setErrors: (errors: string[]) => void
  goToStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
}

// Constants
export const PERMISSION_LEVELS = [
  { value: 'agent', label: 'Agent' },
  { value: 'admin', label: 'Admin' },
]

export const CARRIERS_LIST = [
  'Aetna',
  'Aflac',
  'American Amicable',
  'Combined Insurance',
  'American Home Life',
  'Royal Neighbors',
  'Liberty Bankers Life',
  'Transamerica',
  'Foresters',
  'Reagan CRM Data',
  'Ethos',
  'Mutual of Omaha',
  'Americo',
]
