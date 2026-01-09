"use client"

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export interface TourStep {
  id: string
  title: string
  description: string
  targetPath: string // The route this step should be on
  targetSelector?: string // Optional: DOM selector to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  requiresAdmin?: boolean // If true, only show for admins
}

interface TourContextType {
  isTourActive: boolean
  currentStepIndex: number
  currentStep: TourStep | null
  tourSteps: TourStep[]
  startTour: () => void
  nextStep: (userId?: string) => void
  previousStep: () => void
  skipTour: (userId?: string) => void
  endTour: (userId?: string) => void
  isLastStep: boolean
  isFirstStep: boolean
  userRole: 'admin' | 'agent' | null
  setUserRole: (role: 'admin' | 'agent' | null) => void
}

const TourContext = createContext<TourContextType | undefined>(undefined)

export const useTour = () => {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error('useTour must be used within TourProvider')
  }
  return context
}

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isTourActive, setIsTourActive] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [userRole, setUserRole] = useState<'admin' | 'agent' | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  // Define all tour steps
  const allTourSteps: TourStep[] = [
    {
      id: 'dashboard',
      title: 'Welcome to Your Dashboard!',
      description: userRole === 'admin'
        ? 'This is your dashboard showing agency-wide information including performance metrics, leaderboards, and key statistics.'
        : 'This is your dashboard showing information about you and your downlines, including your performance and team metrics.',
      targetPath: '/',
      targetSelector: '[data-tour="nav-dashboard"]',
      position: 'right'
    },
    {
      id: 'scoreboard',
      title: 'Scoreboard',
      description: 'This is the scoreboard of agents in your agency. You can see rankings, production levels, and performance metrics for all agents.',
      targetPath: '/scoreboard',
      targetSelector: '[data-tour="nav-scoreboard"]',
      position: 'right'
    },
    {
      id: 'agents',
      title: 'Agent Management',
      description: 'Here you can view and manage all agents in your organization. You can filter agents, view their hierarchies, and manage their settings.',
      targetPath: '/agents',
      targetSelector: '[data-tour="nav-agents"]',
      position: 'right'
    },
    {
      id: 'agents-graph',
      title: 'Organization Graph',
      description: 'Click the graph button to visualize your entire organization structure in a tree view. This helps you understand reporting relationships at a glance.',
      targetPath: '/agents',
      targetSelector: '[data-tour="graph-button"]',
      position: 'bottom'
    },
    {
      id: 'agents-positions',
      title: 'Pending Positions',
      description: 'Here you can assign positions to your downline agents. Remember: everyone in the upline must have a position set before agents can post a deal.',
      targetPath: '/agents',
      targetSelector: '[data-tour="pending-positions"]',
      position: 'bottom'
    },
    {
      id: 'post-deal',
      title: 'Post a Deal',
      description: 'This is where you submit new deals. Fill out the required information to track policies and commissions.',
      targetPath: '/policies/post',
      targetSelector: '[data-tour="nav-post-a-deal"]',
      position: 'right'
    },
    {
      id: 'book-of-business',
      title: 'Book of Business',
      description: 'View all your deals in one place. You can filter by various criteria to find specific policies and track their status.',
      targetPath: '/policies/book',
      targetSelector: '[data-tour="nav-book-of-business"]',
      position: 'right'
    },
    {
      id: 'communication',
      title: 'Communication Hub',
      description: 'See all the messages you and your downline agents are sending. Manage SMS communications with clients from this central location.',
      targetPath: '/communications/sms',
      targetSelector: '[data-tour="nav-communication"]',
      position: 'right'
    },
    {
      id: 'analytics',
      title: 'Analytics Dashboard',
      description: userRole === 'admin'
        ? 'Access granular analytics for your entire agency. Create custom reports, track trends, and measure performance across all metrics.'
        : 'Access granular analytics for you and your downlines. Track your performance, identify trends, and measure your success.',
      targetPath: '/analytics',
      targetSelector: '[data-tour="nav-analytics"]',
      position: 'right'
    },
    {
      id: 'expected-payouts',
      title: 'Expected Payouts',
      description: 'See your expected commission payouts. You can filter by date range, carriers, and specific agents to forecast your earnings.',
      targetPath: '/expected-payouts',
      targetSelector: '[data-tour="nav-expected-payouts"]',
      position: 'right'
    },
    {
      id: 'insurance-toolkits',
      title: 'Insurance Toolkits',
      description: 'Access underwriting tools and resources to help you with the sales process. Find calculators, rate sheets, and carrier information.',
      targetPath: '/insurance-toolkits',
      targetSelector: '[data-tour="nav-insurance-toolkits"]',
      position: 'right'
    },
    {
      id: 'ai-mode',
      title: 'AI Mode',
      description: 'Ask AI to create custom graphs and analyze your agency data. Get insights and visualizations tailored to your specific questions.',
      targetPath: '/ai-chat',
      targetSelector: '[data-tour="nav-ai-mode"]',
      position: 'right',
      requiresAdmin: true
    }
  ]

  // Filter steps based on user role - memoize to prevent infinite loops
  const tourSteps = useMemo(() => {
    return allTourSteps.filter(step => {
      if (step.requiresAdmin && userRole !== 'admin') {
        return false
      }
      return true
    })
  }, [userRole])

  // Use refs to avoid dependency issues in callbacks and effects
  const tourStepsRef = useRef(tourSteps)
  useEffect(() => {
    tourStepsRef.current = tourSteps
  }, [tourSteps])

  // Ref to track current step index for callbacks (avoids stale closures)
  const currentStepIndexRef = useRef(currentStepIndex)
  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex
  }, [currentStepIndex])

  // Ref for pending navigation - allows navigation after state update
  const pendingNavigationRef = useRef<string | null>(null)

  // Handle navigation after state updates (avoids "Cannot update during render" error)
  useEffect(() => {
    if (pendingNavigationRef.current) {
      const path = pendingNavigationRef.current
      pendingNavigationRef.current = null
      router.push(path)
    }
  }, [currentStepIndex, router])

  const currentStep = tourSteps[currentStepIndex] || null
  const isLastStep = currentStepIndex === tourSteps.length - 1
  const isFirstStep = currentStepIndex === 0

  const startTour = useCallback(() => {
    setIsTourActive(true)
    setCurrentStepIndex(0)
    // Navigate to first step
    const steps = tourStepsRef.current
    if (steps[0]) {
      router.push(steps[0].targetPath)
    }
  }, [router])

  const skipTour = useCallback((userId?: string) => {
    setIsTourActive(false)
    setCurrentStepIndex(0)

    // Mark tour as completed
    if (userId && typeof window !== 'undefined') {
      localStorage.setItem(`tour_completed_${userId}`, 'true')
    }

    // Navigate to dashboard immediately
    router.push('/')

    // Fire API call in background (don't await)
    fetch('/api/user/complete-onboarding', {
      method: 'POST',
    }).catch(error => {
      console.error('Error completing onboarding:', error)
    })
  }, [router])

  const endTour = useCallback((userId?: string) => {
    setIsTourActive(false)
    setCurrentStepIndex(0)

    // Mark tour as completed
    if (userId && typeof window !== 'undefined') {
      localStorage.setItem(`tour_completed_${userId}`, 'true')
    }

    // Navigate to dashboard immediately
    router.push('/')

    // Fire API call in background (don't await)
    fetch('/api/user/complete-onboarding', {
      method: 'POST',
    }).catch(error => {
      console.error('Error completing onboarding:', error)
    })
  }, [router])

  const nextStep = useCallback((userId?: string) => {
    const steps = tourStepsRef.current
    const currentIndex = currentStepIndexRef.current

    if (currentIndex < steps.length - 1) {
      const nextIndex = currentIndex + 1
      // Set pending navigation if path changes (will be handled by useEffect)
      const currentPath = steps[currentIndex]?.targetPath
      const nextPath = steps[nextIndex]?.targetPath
      if (currentPath !== nextPath) {
        pendingNavigationRef.current = nextPath
      }
      setCurrentStepIndex(nextIndex)
    } else {
      endTour(userId)
    }
  }, [endTour])

  const previousStep = useCallback(() => {
    const currentIndex = currentStepIndexRef.current
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      const steps = tourStepsRef.current
      // Set pending navigation (will be handled by useEffect)
      pendingNavigationRef.current = steps[newIndex].targetPath
      setCurrentStepIndex(newIndex)
    }
  }, [])

  // Auto-adjust step when path changes externally (but not when multiple steps share the same path)
  // Use refs to avoid unnecessary effect triggers
  useEffect(() => {
    if (isTourActive && pathname) {
      const steps = tourStepsRef.current
      setCurrentStepIndex(prevIndex => {
        const currentPath = steps[prevIndex]?.targetPath
        // Only adjust if we navigated to a different path externally
        if (currentPath && currentPath !== pathname) {
          const stepIndex = steps.findIndex(step => step.targetPath === pathname)
          if (stepIndex !== -1) {
            return stepIndex
          }
        }
        return prevIndex
      })
    }
  }, [pathname, isTourActive])

  const contextValue = useMemo(() => ({
    isTourActive, currentStepIndex, currentStep, tourSteps,
    startTour, nextStep, previousStep, skipTour, endTour,
    isLastStep, isFirstStep, userRole, setUserRole
  }), [
    isTourActive, currentStepIndex, currentStep, tourSteps,
    startTour, nextStep, previousStep, skipTour, endTour,
    isLastStep, isFirstStep, userRole
  ])

  return <TourContext.Provider value={contextValue}>{children}</TourContext.Provider>
}
