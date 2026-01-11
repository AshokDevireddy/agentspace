import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * Returns false during SSR and initial hydration, true after hydration completes.
 * Uses useSyncExternalStore for proper React 18 SSR support.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,   // getSnapshot (client)
    () => false   // getServerSnapshot (server)
  )
}
