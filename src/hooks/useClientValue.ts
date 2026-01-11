import { useSyncExternalStore, useRef, useCallback } from 'react'

const subscribe = () => () => {}

/**
 * Returns serverDefault during SSR, clientValue after hydration.
 * Prevents hydration mismatch by ensuring server and client render the same initial value.
 *
 * IMPORTANT: The serverDefault and getClientValue must be memoized by the caller
 * to prevent infinite re-renders.
 *
 * @param serverDefault - Value to use during SSR (must be memoized)
 * @param getClientValue - Function that returns client-specific value (must be memoized)
 */
export function useClientValue<T>(serverDefault: T, getClientValue: () => T): T {
  // Cache the client value - compute once, return same reference
  // This is critical: useSyncExternalStore requires getSnapshot to return
  // the same reference if the underlying data hasn't changed
  const cachedValue = useRef<T | null>(null)

  const getSnapshot = useCallback(() => {
    if (cachedValue.current === null) {
      cachedValue.current = getClientValue()
    }
    return cachedValue.current
  }, [getClientValue])

  const getServerSnapshot = useCallback(() => serverDefault, [serverDefault])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
