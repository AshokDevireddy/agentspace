import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for persisting filter state in localStorage
 * @param key - Unique key for localStorage (e.g., 'agents-filters', 'clients-filters')
 * @param initialState - Default state object when no persisted data exists
 * @param preserveOnClear - Keys to preserve when clearFilters is called (e.g., ['viewMode'])
 * @returns [localState, appliedState, setLocalState, applyFilters, clearFilters, setAndApply]
 */
export function usePersistedFilters<T extends Record<string, any>>(
  key: string,
  initialState: T,
  preserveOnClear: (keyof T)[] = []
): [
  T, // localState
  T, // appliedState
  (updater: Partial<T> | ((prev: T) => T)) => void, // setLocalState
  () => void, // applyFilters
  () => void, // clearFilters
  (updater: Partial<T>) => void // setAndApply - updates both local and applied immediately
] {
  // Initialize state from localStorage or use initial state
  const [localState, setLocalStateInternal] = useState<T>(() => {
    if (typeof window === 'undefined') return initialState;

    try {
      const stored = localStorage.getItem(`filter_${key}_local`);
      return stored ? { ...initialState, ...JSON.parse(stored) } : initialState;
    } catch (error) {
      console.error(`Error loading persisted filters for ${key}:`, error);
      return initialState;
    }
  });

  const [appliedState, setAppliedState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialState;

    try {
      const stored = localStorage.getItem(`filter_${key}_applied`);
      return stored ? { ...initialState, ...JSON.parse(stored) } : initialState;
    } catch (error) {
      console.error(`Error loading persisted filters for ${key}:`, error);
      return initialState;
    }
  });

  // Save local state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(`filter_${key}_local`, JSON.stringify(localState));
    } catch (error) {
      console.error(`Error saving local filters for ${key}:`, error);
    }
  }, [key, localState]);

  // Save applied state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(`filter_${key}_applied`, JSON.stringify(appliedState));
    } catch (error) {
      console.error(`Error saving applied filters for ${key}:`, error);
    }
  }, [key, appliedState]);

  // Enhanced setState that accepts both partial updates and updater functions
  const setLocalState = useCallback((updater: Partial<T> | ((prev: T) => T)) => {
    setLocalStateInternal(prev => {
      if (typeof updater === 'function') {
        return updater(prev);
      }
      return { ...prev, ...updater };
    });
  }, []);

  // Apply filters: copy local state to applied state
  const applyFilters = useCallback(() => {
    setAppliedState(localState);
  }, [localState]);

  // Clear filters: reset both local and applied state to initial values
  // but preserve specified keys (e.g., viewMode)
  const clearFilters = useCallback(() => {
    setLocalStateInternal(prev => {
      const preserved: Partial<T> = {};
      preserveOnClear.forEach(key => {
        preserved[key] = prev[key];
      });
      return { ...initialState, ...preserved };
    });
    setAppliedState(prev => {
      const preserved: Partial<T> = {};
      preserveOnClear.forEach(key => {
        preserved[key] = prev[key];
      });
      return { ...initialState, ...preserved };
    });
  }, [initialState, preserveOnClear]);

  // Set and apply immediately: update both local and applied state at once
  // Use this for real-time filters like tabs, view modes, etc.
  const setAndApply = useCallback((updater: Partial<T>) => {
    setLocalStateInternal(prev => {
      const newState = { ...prev, ...updater };
      setAppliedState(newState);
      return newState;
    });
  }, []);

  return [localState, appliedState, setLocalState, applyFilters, clearFilters, setAndApply];
}
