'use client'

import { Component, ReactNode } from 'react'
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { getUserFriendlyMessage } from '@/lib/error-utils'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary that integrates with TanStack Query's QueryErrorResetBoundary.
 * When the user clicks "Try again", both the error boundary and any failed queries are reset.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    return (
      <QueryErrorResetBoundary>
        {({ reset: resetQueries }) => {
          if (this.state.hasError) {
            if (this.props.fallback) {
              return this.props.fallback
            }

            const errorMessage = getUserFriendlyMessage(this.state.error, 'Something went wrong')

            return (
              <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                <p className="text-sm font-medium text-destructive">Something went wrong</p>
                <p className="text-sm text-destructive/80 mt-1">{errorMessage}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    // Reset both error boundary and TanStack Query errors
                    resetQueries()
                    this.setState({ hasError: false, error: null })
                  }}
                >
                  Try again
                </Button>
              </div>
            )
          }

          return this.props.children
        }}
      </QueryErrorResetBoundary>
    )
  }
}
