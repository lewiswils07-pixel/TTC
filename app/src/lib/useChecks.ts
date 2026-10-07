import { useCallback, useState } from 'react'

/**
 * Tracks which fields have been "touched" so errors appear as soon as they
 * matter: after the member leaves a field, finishes typing a fixed-length
 * value, or presses the main button. From then on they update live.
 */
export function useChecks<K extends string>(errors: Record<K, string | null>) {
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)

  const touch = useCallback((key: K) => setTouched((t) => (t[key] ? t : { ...t, [key]: true })), [])
  const shown = (key: K): string | null => (submitted || touched[key] ? errors[key] : null)

  /** Call on submit. Returns true when everything is fine; otherwise focuses the first problem. */
  function validateAll(): boolean {
    setSubmitted(true)
    const first = (Object.keys(errors) as K[]).find((k) => errors[k])
    if (!first) return true
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] textarea, [data-field="${first}"] select, [data-field="${first}"] .range-day:not(:disabled)`)
      el?.focus()
      el?.closest('[data-field]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    })
    return false
  }

  /** Hide all errors again, for a form that is used more than once. */
  const reset = useCallback(() => {
    setTouched({})
    setSubmitted(false)
  }, [])

  return { shown, touch, validateAll, reset }
}
