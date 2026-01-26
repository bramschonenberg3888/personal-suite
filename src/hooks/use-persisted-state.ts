'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useState, useEffect, useCallback } from 'react';

/**
 * A hook that syncs state with localStorage, SSR-safe.
 * Values are JSON serialized/deserialized automatically.
 *
 * @param key - The localStorage key (will be used as-is)
 * @param defaultValue - Default value when no stored value exists
 * @returns A tuple of [value, setValue] similar to useState
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  // Always initialize with defaultValue for consistent SSR hydration
  const [state, setState] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage after mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        const parsed = JSON.parse(stored) as T;
        // Only update if different from default to avoid unnecessary re-renders
        if (JSON.stringify(parsed) !== JSON.stringify(defaultValue)) {
          setState(parsed);
        }
      }
    } catch {
      console.warn(`Failed to parse localStorage key "${key}", using default value`);
    }
    setIsHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Intentionally exclude defaultValue to only run once per key

  // Sync to localStorage when state changes (after hydration)
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;

    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      console.warn(`Failed to save to localStorage key "${key}"`);
    }
  }, [key, state, isHydrated]);

  // Wrapper to support functional updates
  const setValue = useCallback((value: SetStateAction<T>) => {
    setState(value);
  }, []);

  return [state, setValue];
}
