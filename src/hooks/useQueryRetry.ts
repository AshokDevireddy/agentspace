/**
 * Shared retry configuration for TanStack Query hooks.
 * Handles transient failures like network issues, timeouts, and auth race conditions.
 */

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 8000

/** Error with HTTP status code attached */
export interface HttpError extends Error {
  status?: number
}

/** Creates an error with HTTP status attached for retry logic */
export function createHttpError(message: string, status: number): HttpError {
  const error = new Error(message) as HttpError
  error.status = status
  return error
}

/** Check if an error is transient and should trigger a retry */
export function isRetryableError(error: Error, status?: number): boolean {
  // Retry on 401 (auth may not be ready yet) or 5xx server errors
  if (status === 401 || (status !== undefined && status >= 500)) return true

  const message = error.message.toLowerCase()
  return (
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('aborted') ||
    message.includes('jwt expired') ||
    message.includes('invalid jwt') ||
    message.includes('unauthorized')
  )
}

/** Retry callback for TanStack Query */
export function shouldRetry(failureCount: number, error: Error): boolean {
  if (failureCount >= MAX_RETRIES) return false
  const status = (error as HttpError).status
  return isRetryableError(error, status)
}

/** Exponential backoff delay calculator */
export function getRetryDelay(attemptIndex: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** attemptIndex, MAX_DELAY_MS)
}
