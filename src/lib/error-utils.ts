/**
 * Error utilities for TanStack Query error handling
 * Provides error categorization and user-friendly message generation
 */

// Error categories for consistent handling
export type ErrorCategory = 'network' | 'auth' | 'validation' | 'server' | 'rate_limit' | 'not_found' | 'unknown'

// Custom error classes for specific scenarios
export class RateLimitError extends Error {
  retryAfter: number

  constructor(message: string, retryAfter: number = 60) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class ValidationError extends Error {
  fields?: Record<string, string>

  constructor(message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ValidationError'
    this.fields = fields
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error. Please check your connection.') {
    super(message)
    this.name = 'NetworkError'
  }
}

/**
 * Categorize an error based on its type and message
 */
export function categorizeError(error: unknown): ErrorCategory {
  if (!error) return 'unknown'

  // Handle custom error classes
  if (error instanceof RateLimitError) return 'rate_limit'
  if (error instanceof AuthError) return 'auth'
  if (error instanceof ValidationError) return 'validation'
  if (error instanceof NetworkError) return 'network'

  // Handle fetch/network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'network'
  }

  // Handle Error instances
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Network errors
    if (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('abort')
    ) {
      return 'network'
    }

    // Auth errors
    if (
      message.includes('unauthorized') ||
      message.includes('unauthenticated') ||
      message.includes('invalid token') ||
      message.includes('session expired') ||
      message.includes('token expired') ||
      message.includes('not logged in') ||
      message.includes('invalid credentials') ||
      message.includes('401')
    ) {
      return 'auth'
    }

    // Rate limit errors
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limit'
    }

    // Not found errors
    if (message.includes('not found') || message.includes('does not exist')) {
      return 'not_found'
    }

    // Validation errors
    if (
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('validation')
    ) {
      return 'validation'
    }

    // Server errors
    if (
      message.includes('server error') ||
      message.includes('internal error') ||
      message.includes('500')
    ) {
      return 'server'
    }
  }

  return 'unknown'
}

/**
 * Generate a user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown, fallback?: string): string {
  const category = categorizeError(error)

  // Return specific message for rate limit errors
  if (error instanceof RateLimitError) {
    return `Too many requests. Please try again in ${error.retryAfter} seconds.`
  }

  // Return field-specific message for validation errors
  if (error instanceof ValidationError && error.fields) {
    const fieldErrors = Object.entries(error.fields)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join(', ')
    return `Validation error: ${fieldErrors}`
  }

  // Category-based messages
  switch (category) {
    case 'network':
      return 'Unable to connect. Please check your internet connection and try again.'
    case 'auth':
      return 'Your session has expired. Please sign in again.'
    case 'rate_limit':
      return 'Too many requests. Please wait a moment before trying again.'
    case 'not_found':
      return 'The requested resource was not found.'
    case 'validation':
      return error instanceof Error ? error.message : 'Please check your input and try again.'
    case 'server':
      return 'Something went wrong on our end. Please try again later.'
    default:
      // Use the error message if available, otherwise use fallback
      if (error instanceof Error && error.message) {
        return error.message
      }
      return fallback || 'An unexpected error occurred. Please try again.'
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const category = categorizeError(error)
  return category === 'network' || category === 'server' || category === 'rate_limit'
}

/**
 * Get retry delay for an error (in milliseconds)
 */
export function getRetryDelay(error: unknown, attempt: number = 1): number {
  // Use retry-after for rate limit errors
  if (error instanceof RateLimitError) {
    return error.retryAfter * 1000
  }

  // Exponential backoff with jitter for other retryable errors
  const baseDelay = 1000 // 1 second
  const maxDelay = 30000 // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
  const jitter = Math.random() * 0.3 * delay // Up to 30% jitter

  return delay + jitter
}

/**
 * Create an error from an HTTP response
 */
export async function createErrorFromResponse(response: Response): Promise<Error> {
  let errorMessage = `HTTP ${response.status}: ${response.statusText}`

  try {
    const data = await response.json()
    errorMessage = data.error || data.message || errorMessage
  } catch {
    // Response body wasn't JSON, use status text
  }

  switch (response.status) {
    case 401:
    case 403:
      return new AuthError(errorMessage)
    case 404:
      return new Error('Resource not found')
    case 422:
      return new ValidationError(errorMessage)
    case 429:
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
      return new RateLimitError(errorMessage, retryAfter)
    case 500:
    case 502:
    case 503:
    case 504:
      return new Error('Server error. Please try again later.')
    default:
      return new Error(errorMessage)
  }
}
