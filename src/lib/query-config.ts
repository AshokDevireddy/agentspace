/**
 * Centralized query configuration for TanStack Query.
 */

export const STALE_TIMES = {
  /** 10 seconds - for frequently updating data like messages */
  realtime: 10 * 1000,
  /** 30 seconds - for moderately dynamic data */
  fast: 30 * 1000,
  /** 1 minute - for standard data */
  standard: 60 * 1000,
  /** 2 minutes - for slower changing data */
  medium: 2 * 60 * 1000,
  /** 5 minutes - for relatively static data */
  slow: 5 * 60 * 1000,
  /** 15 minutes - for mostly static data like filter options */
  static: 15 * 60 * 1000,
} as const
