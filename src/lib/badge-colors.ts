/**
 * Badge and Status Color Mappings
 *
 * Shared color definitions for agent badges and status indicators.
 * Used throughout the application for consistent styling.
 */

/**
 * Color mappings for agent position badges.
 * Each badge type has a specific color scheme for visual distinction.
 */
export const badgeColors: Record<string, string> = {
  "Legacy Junior Partner": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Karma Director 2": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Karma Director 1": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Legacy MGA": "bg-green-500/20 text-green-400 border-green-500/30",
  "Legacy GA": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Legacy SA": "bg-red-500/20 text-red-400 border-red-500/30",
}

/**
 * Color mappings for user status indicators.
 * Provides visual feedback for different account states.
 */
export const statusColors: Record<string, string> = {
  "pre-invite": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "invited": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "onboarding": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "active": "bg-green-500/20 text-green-400 border-green-500/30",
  "inactive": "bg-red-500/20 text-red-400 border-red-500/30",
}

/**
 * Get the color class for a badge, with a fallback default.
 */
export function getBadgeColor(badge: string | undefined | null): string {
  if (!badge) return 'bg-muted text-muted-foreground'
  return badgeColors[badge] || 'bg-muted text-muted-foreground'
}

/**
 * Get the color class for a status, with a fallback default.
 */
export function getStatusColor(status: string | undefined | null): string {
  if (!status) return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  return statusColors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}
