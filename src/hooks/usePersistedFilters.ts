import { useSyncExternalStore, useCallback, useRef, useEffect } from 'react'

/**
 * SSR-safe persisted filters hook using useSyncExternalStore.
 * Returns initialState on server, synced localStorage value on client.
 */
export function usePersistedFilters<T extends Record<string, unknown>>(
  key: string,
  initialState: T,
  preserveOnClear: (keyof T)[] = []
) {
  // Keep refs to avoid stale closures
  const initialRef = useRef(initialState)
  initialRef.current = initialState

  const preserveRef = useRef(preserveOnClear)
  preserveRef.current = preserveOnClear

  // Cache refs for snapshot results - critical for useSyncExternalStore
  const localCacheRef = useRef<{ raw: string | null; parsed: T } | null>(null)
  const appliedCacheRef = useRef<{ raw: string | null; parsed: T } | null>(null)

  // Subscribe function for localStorage changes
  const subscribe = useCallback((callback: () => void) => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(`filter_${key}`) || e.key === null) {
        callback()
      }
    }

    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.key?.startsWith(`filter_${key}`)) {
        callback()
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('localStorage-update', handleCustom)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('localStorage-update', handleCustom)
    }
  }, [key])

  // Snapshot functions - MUST return cached value if data hasn't changed
  const getLocalSnapshot = useCallback(() => {
    try {
      const stored = localStorage.getItem(`filter_${key}_local`)
      // Return cached value if raw string is the same
      if (localCacheRef.current && localCacheRef.current.raw === stored) {
        return localCacheRef.current.parsed
      }
      const parsed = stored ? { ...initialRef.current, ...JSON.parse(stored) } : initialRef.current
      localCacheRef.current = { raw: stored, parsed }
      return parsed
    } catch {
      return initialRef.current
    }
  }, [key])

  const getAppliedSnapshot = useCallback(() => {
    try {
      const stored = localStorage.getItem(`filter_${key}_applied`)
      // Return cached value if raw string is the same
      if (appliedCacheRef.current && appliedCacheRef.current.raw === stored) {
        return appliedCacheRef.current.parsed
      }
      const parsed = stored ? { ...initialRef.current, ...JSON.parse(stored) } : initialRef.current
      appliedCacheRef.current = { raw: stored, parsed }
      return parsed
    } catch {
      return initialRef.current
    }
  }, [key])

  const getServerSnapshot = useCallback(() => initialRef.current, [])

  // Use useSyncExternalStore for SSR-safe state
  const localState = useSyncExternalStore(subscribe, getLocalSnapshot, getServerSnapshot)
  const appliedState = useSyncExternalStore(subscribe, getAppliedSnapshot, getServerSnapshot)

  // Debounced save for local state
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Helper to save and notify
  const saveToStorage = useCallback((storageKey: string, value: T) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
      window.dispatchEvent(new CustomEvent('localStorage-update', {
        detail: { key: storageKey }
      }))
    } catch (error) {
      console.error(`Error saving filters for ${storageKey}:`, error)
    }
  }, [])

  // Set local filters (with debounced save)
  const setLocalFilters = useCallback((updater: Partial<T> | ((prev: T) => T)) => {
    clearTimeout(saveTimeoutRef.current)

    const currentLocal = (() => {
      try {
        const stored = localStorage.getItem(`filter_${key}_local`)
        return stored ? { ...initialRef.current, ...JSON.parse(stored) } : initialRef.current
      } catch {
        return initialRef.current
      }
    })()

    const newState = typeof updater === 'function'
      ? updater(currentLocal)
      : { ...currentLocal, ...updater }

    // Debounce the save
    saveTimeoutRef.current = setTimeout(() => {
      saveToStorage(`filter_${key}_local`, newState)
    }, 300)

    // Immediately notify for UI update
    saveToStorage(`filter_${key}_local`, newState)
  }, [key, saveToStorage])

  // Apply filters (copy local to applied)
  const applyFilters = useCallback(() => {
    const currentLocal = (() => {
      try {
        const stored = localStorage.getItem(`filter_${key}_local`)
        return stored ? { ...initialRef.current, ...JSON.parse(stored) } : initialRef.current
      } catch {
        return initialRef.current
      }
    })()

    saveToStorage(`filter_${key}_applied`, currentLocal)
  }, [key, saveToStorage])

  // Set and apply in one action
  const setAndApply = useCallback((updater: Partial<T>) => {
    const currentLocal = (() => {
      try {
        const stored = localStorage.getItem(`filter_${key}_local`)
        return stored ? { ...initialRef.current, ...JSON.parse(stored) } : initialRef.current
      } catch {
        return initialRef.current
      }
    })()

    const newState = { ...currentLocal, ...updater }

    saveToStorage(`filter_${key}_local`, newState)
    saveToStorage(`filter_${key}_applied`, newState)
  }, [key, saveToStorage])

  // Clear filters (preserving specified keys)
  const clearFilters = useCallback(() => {
    const currentLocal = (() => {
      try {
        const stored = localStorage.getItem(`filter_${key}_local`)
        return stored ? { ...initialRef.current, ...JSON.parse(stored) } : initialRef.current
      } catch {
        return initialRef.current
      }
    })()

    const preserved: Partial<T> = {}
    preserveRef.current.forEach(k => {
      preserved[k] = currentLocal[k]
    })

    const newState = { ...initialRef.current, ...preserved } as T

    saveToStorage(`filter_${key}_local`, newState)
    saveToStorage(`filter_${key}_applied`, newState)
  }, [key, saveToStorage])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    localFilters: localState,
    appliedFilters: appliedState,
    setLocalFilters,
    applyFilters,
    setAndApply,
    clearFilters,
  }
}
