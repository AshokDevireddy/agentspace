/**
 * Onboarding Components
 *
 * Modular onboarding wizard components with server-side state management.
 */

export { default as OnboardingWizard } from './OnboardingWizard'
export { NiprVerificationStep } from './steps/NiprVerificationStep'
export { TeamInvitationStep } from './steps/TeamInvitationStep'

export type {
  UserData,
  InvitedAgent,
  NiprForm,
  NiprResult,
  NiprAnalysis,
  OnboardingStep,
  NiprMode,
  NiprStatus,
} from './types'

export { PERMISSION_LEVELS, CARRIERS_LIST } from './types'
