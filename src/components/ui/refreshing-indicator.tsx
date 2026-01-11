"use client"

import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface RefreshingIndicatorProps {
  /** Whether data is being refreshed in the background */
  isRefreshing: boolean
  /** Additional CSS classes */
  className?: string
  /** Size of the indicator */
  size?: "sm" | "md"
}

/**
 * Subtle loading indicator for background data refetches.
 * Use when placeholderData is shown but fresh data is being fetched.
 *
 * Usage:
 * const { data, isLoading, isFetching } = useQuery(...)
 * const isRefreshing = isFetching && !isLoading
 * <RefreshingIndicator isRefreshing={isRefreshing} />
 */
export function RefreshingIndicator({
  isRefreshing,
  className,
  size = "sm"
}: RefreshingIndicatorProps) {
  if (!isRefreshing) return null

  const sizeClasses = size === "sm" ? "h-3 w-3" : "h-4 w-4"

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-muted-foreground text-xs animate-in fade-in duration-200",
        className
      )}
    >
      <Loader2 className={cn(sizeClasses, "animate-spin")} />
      <span>Refreshing...</span>
    </div>
  )
}

/**
 * Inline refreshing indicator without text, just the spinner.
 * Useful for tight spaces like table headers.
 */
export function RefreshingSpinner({
  isRefreshing,
  className,
  size = "sm"
}: RefreshingIndicatorProps) {
  if (!isRefreshing) return null

  const sizeClasses = size === "sm" ? "h-3 w-3" : "h-4 w-4"

  return (
    <Loader2
      className={cn(
        sizeClasses,
        "animate-spin text-muted-foreground animate-in fade-in duration-200",
        className
      )}
    />
  )
}
