// Unsaved sign-up typing, kept in this tab so a refresh or the app's own
// Back button doesn't lose it (testers lost names, dates and bios). Cleared
// once the step is saved.
import { useState } from 'react'

const prefix = 'sodalis.draft.'

function read<T>(key: string): T | undefined {
  try {
    const saved = sessionStorage.getItem(prefix + key)
    return saved === null ? undefined : (JSON.parse(saved) as T)
  } catch {
    return undefined
  }
}

/** Like useState, but the value survives a refresh until clearDrafts(). */
export function useDraft<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => read<T>(key) ?? initial)
  return [
    value,
    (next: T) => {
      setValue(next)
      try {
        sessionStorage.setItem(prefix + key, JSON.stringify(next))
      } catch {
        // Private browsing: just not kept.
      }
    },
  ]
}

/** Forgets the drafts whose keys start with this (e.g. "basics."). */
export function clearDrafts(start: string): void {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix + start)) sessionStorage.removeItem(key)
  } catch {
    // Nothing kept.
  }
}
