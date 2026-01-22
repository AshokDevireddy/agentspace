/**
 * Feature Flags for Django Backend Migration
 *
 * Controls gradual rollout of Django backend endpoints.
 * Currently uses environment variables; can be upgraded to PostHog later.
 */

export enum FeatureFlags {
  USE_DJANGO_AUTH = 'use_django_auth',
  USE_DJANGO_DASHBOARD = 'use_django_dashboard',
}

/**
 * Check if a feature flag is enabled.
 * Reads from environment variables for now.
 */
export function isFeatureEnabled(flag: FeatureFlags): boolean {
  // Master switch - if Django backend is disabled, all flags are off
  if (process.env.NEXT_PUBLIC_USE_DJANGO_BACKEND !== 'true') {
    return false
  }

  // Individual flag overrides
  switch (flag) {
    case FeatureFlags.USE_DJANGO_AUTH:
      // Default to true if master switch is on (can be overridden)
      return process.env.NEXT_PUBLIC_DJANGO_AUTH_ENABLED !== 'false'
    case FeatureFlags.USE_DJANGO_DASHBOARD:
      // Default to true if master switch is on (can be overridden)
      return process.env.NEXT_PUBLIC_DJANGO_DASHBOARD_ENABLED !== 'false'
    default:
      return false
  }
}

/**
 * Convenience function to check if Django auth should be used
 */
export function shouldUseDjangoAuth(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_AUTH)
}

/**
 * Convenience function to check if Django dashboard should be used
 */
export function shouldUseDjangoDashboard(): boolean {
  return isFeatureEnabled(FeatureFlags.USE_DJANGO_DASHBOARD)
}
