import { useSyncExternalStore, useCallback, useRef } from 'react'

type SetValue<T> = (value: T | ((prev: T) => T)) => void

/**
 * SSR-safe localStorage hook using useSyncExternalStore.
 * Returns defaultValue on server, synced localStorage value on client.
 *
 * @param key - localStorage key
 * @param defaultValue - Default value (used on server and when key doesn't exist)
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, SetValue<T>] {
  // Use ref to store latest default value for getServerSnapshot
  const defaultRef = useRef(defaultValue)
  defaultRef.current = defaultValue

  const subscribe = useCallback((callback: () => void) => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) {
        callback()
      }
    }

    // Listen to custom events for same-tab updates
    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.key === key) {
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

  const getSnapshot = useCallback(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : defaultRef.current
    } catch {
      return defaultRef.current
    }
  }, [key])

  const getServerSnapshot = useCallback(() => defaultRef.current, [])

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setValue: SetValue<T> = useCallback((newValue) => {
    try {
      const currentValue = (() => {
        try {
          const item = localStorage.getItem(key)
          return item ? (JSON.parse(item) as T) : defaultRef.current
        } catch {
          return defaultRef.current
        }
      })()

      const valueToStore = newValue instanceof Function
        ? newValue(currentValue)
        : newValue

      localStorage.setItem(key, JSON.stringify(valueToStore))

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new CustomEvent('localStorage-update', {
        detail: { key, value: valueToStore }
      }))
    } catch (error) {
      console.error(`Error saving to localStorage key "${key}":`, error)
    }
  }, [key])

  return [value, setValue]
}
