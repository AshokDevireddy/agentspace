'use client'

import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, WifiOff, Lock, Clock, ServerCrash } from 'lucide-react'
import { getUserFriendlyMessage, isRetryableError, categorizeError, ErrorCategory } from '@/lib/error-utils'
import { cn } from '@/lib/utils'

interface QueryErrorDisplayProps {
  error: Error | null
  onRetry?: () => void
  isRetrying?: boolean
  variant?: 'inline' | 'card'
  className?: string
  title?: string
}

const errorIcons: Record<ErrorCategory, React.ReactNode> = {
  network: <WifiOff className="h-5 w-5" />,
  auth: <Lock className="h-5 w-5" />,
  rate_limit: <Clock className="h-5 w-5" />,
  server: <ServerCrash className="h-5 w-5" />,
  validation: <AlertCircle className="h-5 w-5" />,
  not_found: <AlertCircle className="h-5 w-5" />,
  unknown: <AlertCircle className="h-5 w-5" />,
}

export function QueryErrorDisplay({
  error,
  onRetry,
  isRetrying = false,
  variant = 'inline',
  className,
  title,
}: QueryErrorDisplayProps) {
  if (!error) return null

  const category = categorizeError(error)
  const message = getUserFriendlyMessage(error)
  const canRetry = isRetryableError(error) && onRetry
  const Icon = errorIcons[category]

  if (variant === 'inline') {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive",
        className
      )}>
        {Icon}
        <span className="text-sm flex-1">{message}</span>
        {canRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
          </Button>
        )}
      </div>
    )
  }

  // card variant
  return (
    <div className={cn(
      "rounded-xl border border-destructive/20 bg-destructive/5 p-6",
      className
    )}>
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
          {Icon}
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-destructive">
            {title || 'Failed to load data'}
          </h3>
          <p className="text-sm text-destructive/80">{message}</p>
        </div>
        {canRetry && (
          <Button
            variant="outline"
            onClick={onRetry}
            disabled={isRetrying}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}
