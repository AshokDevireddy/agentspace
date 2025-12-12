const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_REQUESTS = 20

// In-memory store: identifier -> array of request timestamps
const requestStore = new Map<string, number[]>()

// Clean up old entries periodically
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  const cutoff = now - WINDOW_MS
  for (const [key, timestamps] of requestStore.entries()) {
    const valid = timestamps.filter(t => t > cutoff)
    if (valid.length === 0) {
      requestStore.delete(key)
    } else {
      requestStore.set(key, valid)
    }
  }
  lastCleanup = now
}

export function checkRateLimit(identifier: string): {
  allowed: boolean
  remaining: number
  resetAt: Date
} {
  cleanup()

  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const timestamps = requestStore.get(identifier) || []
  const validTimestamps = timestamps.filter(t => t > cutoff)

  const count = validTimestamps.length
  const allowed = count < MAX_REQUESTS

  // Calculate when the oldest request in the window will expire
  const oldestTimestamp = validTimestamps.length > 0 ? Math.min(...validTimestamps) : now
  const resetAt = new Date(oldestTimestamp + WINDOW_MS)

  return {
    allowed,
    remaining: Math.max(0, MAX_REQUESTS - count),
    resetAt
  }
}

export function recordRequest(identifier: string): void {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const timestamps = requestStore.get(identifier) || []
  const validTimestamps = timestamps.filter(t => t > cutoff)
  validTimestamps.push(now)
  requestStore.set(identifier, validTimestamps)
}

export function getSecondsUntilReset(resetAt: Date): number {
  return Math.ceil((resetAt.getTime() - Date.now()) / 1000)
}
