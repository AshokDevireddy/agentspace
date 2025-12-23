"use client"

import React, { useEffect, useState, useRef } from 'react'
import { useTour } from '@/contexts/onboarding-tour-context'
import { useAuth } from '@/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export default function OnboardingTour() {
  const { user } = useAuth()
  const {
    isTourActive,
    currentStep,
    currentStepIndex,
    tourSteps,
    nextStep,
    previousStep,
    skipTour,
    isLastStep,
    isFirstStep,
  } = useTour()

  const [highlightPosition, setHighlightPosition] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)

  const [tooltipPosition, setTooltipPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isTourActive || !currentStep) {
      setHighlightPosition(null)
      setTooltipPosition(null)
      return
    }

    const updatePosition = () => {
      if (currentStep.targetSelector) {
        const element = document.querySelector(currentStep.targetSelector)
        if (element) {
          const rect = element.getBoundingClientRect()
          const padding = 8

          setHighlightPosition({
            top: rect.top + window.scrollY - padding,
            left: rect.left + window.scrollX - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
          })

          // Calculate tooltip position
          calculateTooltipPosition(rect)
        } else {
          // If element not found, center the tooltip
          setCenteredTooltip()
        }
      } else {
        // No specific target, center the tooltip
        setCenteredTooltip()
      }
    }

    const calculateTooltipPosition = (targetRect: DOMRect) => {
      const tooltipWidth = 400 // Approximate tooltip width
      const tooltipHeight = tooltipRef.current?.offsetHeight || 200
      const padding = 20
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let top = 0
      let left = 0

      // Check if this is a navbar item
      const isNavbarItem = currentStep.targetSelector?.includes('nav-')

      switch (currentStep.position) {
        case 'top':
          top = targetRect.top + window.scrollY - tooltipHeight - padding
          left = targetRect.left + window.scrollX + targetRect.width / 2 - tooltipWidth / 2
          break
        case 'bottom':
          top = targetRect.bottom + window.scrollY + padding
          left = targetRect.left + window.scrollX + targetRect.width / 2 - tooltipWidth / 2
          break
        case 'left':
          top = targetRect.top + window.scrollY + targetRect.height / 2 - tooltipHeight / 2
          left = targetRect.left + window.scrollX - tooltipWidth - padding
          break
        case 'right':
          // For navbar items with 'right' position, center the tooltip in the page content area
          if (isNavbarItem) {
            top = viewportHeight / 2 - tooltipHeight / 2 + window.scrollY
            // On large screens, account for the sidebar width (256px)
            if (viewportWidth >= 1024) {
              const contentAreaLeft = 256 // Sidebar width
              const contentAreaWidth = viewportWidth - contentAreaLeft
              left = contentAreaLeft + (contentAreaWidth - tooltipWidth) / 2
            } else {
              left = (viewportWidth - tooltipWidth) / 2
            }
          } else {
            // For non-navbar items (graph, pending positions), keep below the element
            top = targetRect.top + window.scrollY + targetRect.height / 2 - tooltipHeight / 2
            left = targetRect.right + window.scrollX + padding
          }
          break
        case 'center':
        default:
          // Position in center of viewport
          top = viewportHeight / 2 - tooltipHeight / 2 + window.scrollY
          if (viewportWidth >= 1024) {
            const contentAreaLeft = 256
            const contentAreaWidth = viewportWidth - contentAreaLeft
            left = contentAreaLeft + (contentAreaWidth - tooltipWidth) / 2
          } else {
            left = Math.max(padding, (viewportWidth - tooltipWidth) / 2)
          }
          break
      }

      // Keep tooltip within viewport bounds
      left = Math.max(padding, Math.min(left, viewportWidth - tooltipWidth - padding))
      top = Math.max(padding + window.scrollY, top)

      setTooltipPosition({ top, left })
    }

    const setCenteredTooltip = () => {
      const tooltipHeight = tooltipRef.current?.offsetHeight || 200
      const tooltipWidth = 400
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const padding = 20

      let left
      if (viewportWidth >= 1024) {
        const contentAreaLeft = 256 // Sidebar width
        const contentAreaWidth = viewportWidth - contentAreaLeft
        left = contentAreaLeft + (contentAreaWidth - tooltipWidth) / 2
      } else {
        left = Math.max(padding, (viewportWidth - tooltipWidth) / 2)
      }

      setTooltipPosition({
        top: viewportHeight / 2 - tooltipHeight / 2 + window.scrollY,
        left,
      })
      setHighlightPosition(null)
    }

    // Update position immediately, then again after a brief delay for DOM settling
    // Use requestAnimationFrame for smoother rendering
    updatePosition()
    const rafId = requestAnimationFrame(() => {
      updatePosition()
    })

    // Update on scroll and resize
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [isTourActive, currentStep])

  if (!isTourActive || !currentStep) {
    return null
  }

  // Check if this is a navbar item (don't show overlay for navbar)
  const isNavbarItem = currentStep.targetSelector?.includes('nav-')
  const showOverlay = highlightPosition && !isNavbarItem

  return (
    <>
      {/* Light overlay - only when highlighting specific page elements (not navbar) */}
      {showOverlay && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <mask id="tour-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={highlightPosition.left}
                  y={highlightPosition.top}
                  width={highlightPosition.width}
                  height={highlightPosition.height}
                  rx="8"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.4)"
              mask="url(#tour-mask)"
            />
          </svg>
        </div>
      )}

      {/* Highlighted element border */}
      {highlightPosition && (
        <div
          className="fixed rounded-lg pointer-events-none z-[100]"
          style={{
            top: `${highlightPosition.top}px`,
            left: `${highlightPosition.left}px`,
            width: `${highlightPosition.width}px`,
            height: `${highlightPosition.height}px`,
            border: '2px solid hsl(var(--primary))',
            boxShadow: '0 0 0 2px hsla(var(--primary), 0.2), 0 0 20px 4px hsla(var(--primary), 0.3)',
            transition: 'all 0.3s ease-in-out',
          }}
        />
      )}

      {/* Tour tooltip */}
      {tooltipPosition && (
        <div
          ref={tooltipRef}
          className="fixed z-[101] pointer-events-auto"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transition: 'all 0.3s ease-in-out',
          }}
        >
          <div className="bg-card border border-border rounded-lg shadow-2xl w-[400px] max-w-[90vw]">
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: 'hsl(var(--primary))' }}
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    Step {currentStepIndex + 1} of {tourSteps.length}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {currentStep.title}
                </h3>
              </div>
              <button
                onClick={() => skipTour(user?.id)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 -mt-1"
                aria-label="Close tour"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-6">
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {currentStep.description}
              </p>

              {/* Progress bar */}
              <div className="w-full bg-secondary rounded-full h-1.5 mb-6">
                <div
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentStepIndex + 1) / tourSteps.length) * 100}%`,
                    backgroundColor: 'hsl(var(--primary))',
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => skipTour(user?.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Skip Tour
                </Button>

                <div className="flex items-center gap-2">
                  {!isFirstStep && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={previousStep}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => nextStep(user?.id)}
                    style={{ backgroundColor: 'hsl(var(--primary))' }}
                    className="gap-1 text-primary-foreground"
                  >
                    {isLastStep ? 'Finish' : 'Next'}
                    {!isLastStep && <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
