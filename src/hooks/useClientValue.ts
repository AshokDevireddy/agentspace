import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * Returns serverDefault during SSR, clientValue after hydration.
 * Prevents hydration mismatch by ensuring server and client render the same initial value.
 *
 * @param serverDefault - Value to use during SSR (must be deterministic)
 * @param getClientValue - Function that returns client-specific value
 */
export function useClientValue<T>(serverDefault: T, getClientValue: () => T): T {
  return useSyncExternalStore(
    subscribe,
    getClientValue,       // getSnapshot (client)
    () => serverDefault   // getServerSnapshot (server)
  )
}
