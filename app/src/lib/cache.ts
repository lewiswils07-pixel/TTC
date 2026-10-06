// The last data each main screen showed, kept in memory so returning to a
// screen shows it straight away while fresh data loads in the background.
// Cleared on sign-out, and never saved to the device.
const store = new Map<string, unknown>()

/** What was last loaded for this key, if anything. */
export function peek<T>(key: string): T | undefined {
  return store.get(key) as T | undefined
}

/** Loads fresh data and remembers it for next time. */
export async function remember<T>(key: string, load: Promise<T>): Promise<T> {
  const value = await load
  store.set(key, value)
  return value
}

/** Updates what's remembered after a change on this screen, so going back doesn't briefly show the old version. */
export function keep<T>(key: string, value: T): void {
  store.set(key, value)
}

export function clearCache(): void {
  store.clear()
}
