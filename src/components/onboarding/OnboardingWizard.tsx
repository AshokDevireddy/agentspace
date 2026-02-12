'use client'

/**
 * Onboarding Wizard
 *
 * Main container component for the onboarding flow.
 * Uses backend API for server-side state management.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queryKeys'
import { useApiFetch } from '@/hooks/useApiFetch'
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress'
import { fetchWithCredentials } from '@/lib/api-client'
import { useAuth } from '@/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { NiprVerificationStep } from './steps/NiprVerificationStep'
import { TeamInvitationStep } from './steps/TeamInvitationStep'
import type { UserData } from './types'

interface OnboardingWizardProps {
  userData: UserData
  onComplete: () => void
}

export default function OnboardingWizard({ userData, onComplete }: OnboardingWizardProps) {
  const router = useRouter()
  const { signOut } = useAuth()
  const onboardingProgress = useOnboardingProgress(userData.id)

  // Step management
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState<string[]>([])
  const errorRef = useRef<HTMLDivElement>(null)

  // NIPR state
  const [niprAlreadyCompleted, setNiprAlreadyCompleted] = useState(false)
  const [storedCarriers, setStoredCarriers] = useState<string[]>([])

  // Scroll to errors
  useEffect(() => {
    if (errors.length > 0 && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [errors])

  // Sync step with server state
  useEffect(() => {
    if (onboardingProgress?.progress) {
      const serverStep = onboardingProgress.progress.current_step
      if (serverStep === 'nipr_verification') {
        setCurrentStep(1)
      } else if (serverStep === 'team_invitation') {
        setCurrentStep(3)
      } else if (serverStep === 'completed') {
        onComplete()
      }
    }
  }, [onboardingProgress?.progress, onComplete])

  // Check if NIPR already completed
  const { data: niprStatusData } = useApiFetch<{ completed: boolean; carriers: string[] }>(
    queryKeys.niprStatus(userData.id),
    '/api/nipr/status',
    {
      enabled: !!userData.id,
      staleTime: 5 * 60 * 1000,
      retry: false,
    }
  )

  useEffect(() => {
    if (niprStatusData?.completed && niprStatusData.carriers.length > 0) {
      setNiprAlreadyCompleted(true)
      setStoredCarriers(niprStatusData.carriers)
      if (currentStep === 1) {
        setCurrentStep(3)
      }
    }
  }, [niprStatusData, currentStep])

  // Store carriers in database via Django API
  const storeCarriersInDatabase = useCallback(
    async (carriers: string[]) => {
      if (!userData.id || !Array.isArray(carriers) || carriers.length === 0) return

      const validCarriers = carriers.filter(
        (c) => c && typeof c === 'string' && c.trim().length > 0
      )

      if (validCarriers.length === 0) return

      try {
        await fetchWithCredentials(
          `/api/user/${userData.id}/carriers`,
          'Failed to store carriers',
          {
            method: 'PATCH',
            body: { unique_carriers: validCarriers },
          }
        )
      } catch (error) {
        console.error('[OnboardingWizard] Failed to store carriers:', error)
      }
    },
    [userData.id]
  )

  // Handle NIPR completion
  const handleNiprComplete = useCallback(
    async (carriers: string[]) => {
      // Store carriers
      await storeCarriersInDatabase(carriers)

      // Update server state
      if (onboardingProgress) {
        await onboardingProgress.updateProgress({
          step: 'team_invitation',
          nipr_status: 'completed',
          nipr_carriers: carriers,
        })
      }

      // Advance to next step
      setTimeout(() => {
        setCurrentStep(3)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 2000)
    },
    [onboardingProgress, storeCarriersInDatabase]
  )

  // Handle NIPR skip
  const handleNiprSkip = useCallback(async () => {
    // Update server state
    if (onboardingProgress) {
      await onboardingProgress.updateProgress({
        step: 'team_invitation',
        nipr_status: 'skipped',
      })
    }

    setCurrentStep(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [onboardingProgress])

  // Handle team invitation back
  const handleTeamBack = useCallback(async () => {
    if (onboardingProgress) {
      await onboardingProgress.updateProgress({
        step: 'nipr_verification',
      })
    }
    setCurrentStep(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [onboardingProgress])

  // Handle completion
  const handleComplete = useCallback(async () => {
    try {
      // Mark onboarding as complete via Django API
      // This also sets user status to 'active'
      if (onboardingProgress) {
        await onboardingProgress.completeOnboarding()
      }

      // Call parent completion handler
      onComplete()
    } catch (error) {
      console.error('[OnboardingWizard] Completion error:', error)
      setErrors(['Failed to complete onboarding. Please try again.'])
    }
  }, [onboardingProgress, onComplete])

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header with Logout */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-foreground dark:text-white">
              Complete Your Setup
            </h1>
            <p className="text-muted-foreground">
              Verify your credentials and invite your team to get started
            </p>
          </div>
          <Button
            onClick={signOut}
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 border-destructive/30"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Error Banner */}
        {errors.length > 0 && (
          <div
            ref={errorRef}
            className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/30"
          >
            {errors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            1
          </div>
          <div className={`flex-1 h-1 ${currentStep >= 3 ? 'bg-primary' : 'bg-muted'}`} />
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            2
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-card rounded-lg shadow-lg border border-border p-8">
          {/* Step 1: NIPR Verification */}
          {currentStep === 1 && (
            <NiprVerificationStep
              userData={userData}
              onComplete={handleNiprComplete}
              onSkip={handleNiprSkip}
              niprAlreadyCompleted={niprAlreadyCompleted}
              storedCarriers={storedCarriers}
            />
          )}

          {/* Step 3: Team Invitation */}
          {currentStep === 3 && (
            <TeamInvitationStep
              userData={userData}
              onComplete={handleComplete}
              onBack={handleTeamBack}
            />
          )}
        </div>
      </div>
    </div>
  )
}
