import { useState, useEffect, useCallback, useRef } from 'react'

export function usePersistedFilters<T extends Record<string, unknown>>(
  key: string,
  initialState: T,
  preserveOnClear: (keyof T)[] = []
) {
  const [localState, setLocalStateInternal] = useState<T>(() => {
    if (typeof window === 'undefined') return initialState
    try {
      const stored = localStorage.getItem(`filter_${key}_local`)
      return stored ? { ...initialState, ...JSON.parse(stored) } : initialState
    } catch {
      return initialState
    }
  })

  const [appliedState, setAppliedState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialState
    try {
      const stored = localStorage.getItem(`filter_${key}_applied`)
      return stored ? { ...initialState, ...JSON.parse(stored) } : initialState
    } catch {
      return initialState
    }
  })

  const saveTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (typeof window === 'undefined') return
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`filter_${key}_local`, JSON.stringify(localState))
      } catch (error) {
        console.error(`Error saving local filters for ${key}:`, error)
      }
    }, 300)
    return () => clearTimeout(saveTimeoutRef.current)
  }, [key, localState])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(`filter_${key}_applied`, JSON.stringify(appliedState))
    } catch (error) {
      console.error(`Error saving applied filters for ${key}:`, error)
    }
  }, [key, appliedState])

  const setLocalFilters = useCallback((updater: Partial<T> | ((prev: T) => T)) => {
    setLocalStateInternal(prev => {
      if (typeof updater === 'function') {
        return updater(prev)
      }
      return { ...prev, ...updater }
    })
  }, [])

  const applyFilters = useCallback(() => {
    setLocalStateInternal(current => {
      setAppliedState(current)
      return current
    })
  }, [])

  const setAndApply = useCallback((updater: Partial<T>) => {
    setLocalStateInternal(prev => {
      const newState = { ...prev, ...updater }
      setAppliedState(newState)
      return newState
    })
  }, [])

  const clearFilters = useCallback(() => {
    setLocalStateInternal(prev => {
      const preserved: Partial<T> = {}
      preserveOnClear.forEach(k => {
        preserved[k] = prev[k]
      })
      const newState = { ...initialState, ...preserved } as T
      setAppliedState(newState)
      return newState
    })
  }, [initialState, preserveOnClear])

  return {
    localFilters: localState,
    appliedFilters: appliedState,
    setLocalFilters,
    applyFilters,
    setAndApply,
    clearFilters,
  }
}
