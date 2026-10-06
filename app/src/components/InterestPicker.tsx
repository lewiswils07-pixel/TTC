import { useEffect, useId, useMemo, useState } from 'react'
import type { Interest } from '../lib/profile'
import { groupInterests } from '../lib/interests'
import { FieldError } from './Field'

type Props = {
  interests: Interest[]
  selected: number[]
  onChange: (next: number[]) => void
  max: number
  error?: string | null
}

/** Interests shown per group before "Show more" (sign-up review item 10). */
export const FOLDED = 6

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Interests grouped by category, with a search box and compact tappable chips. */
export function InterestPicker({ interests, selected, onChange, max, error }: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string[]>([])
  const groups = useMemo(() => groupInterests(interests), [interests])
  const q = fold(query.trim())
  const visible = q ? groups.map((g) => ({ ...g, items: g.items.filter((i) => fold(i.label).includes(q)) })).filter((g) => g.items.length) : groups
  const atMax = selected.length >= max
  const chosen = interests.filter((i) => selected.includes(i.id))

  // Tapping a new one once the limit is reached explains why nothing happened, near where they tapped.
  const [nudge, setNudge] = useState(0)
  useEffect(() => {
    if (!nudge) return
    const t = window.setTimeout(() => setNudge(0), 3500)
    return () => window.clearTimeout(t)
  }, [nudge])

  const toggle = (interestId: number) => {
    if (selected.includes(interestId)) return onChange(selected.filter((v) => v !== interestId))
    if (atMax) return setNudge((n) => n + 1)
    onChange([...selected, interestId])
  }

  return (
    <div className="interests" data-field="interests">
      <div className="field">
        <label htmlFor={`${id}-search`}>Search interests</label>
        <input
          id={`${id}-search`}
          className="input input-search"
          type="search"
          placeholder="For example, wine or walking"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {chosen.length > 0 && (
        <section className="chosen" aria-label="Your picks">
          <ul className="chip-list">
            {chosen.map((i) => (
              <li key={i.id}>
                <button type="button" className="chip-remove" onClick={() => toggle(i.id)} aria-label={`Remove ${i.label}`}>
                  {i.label} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FieldError error={error} />
      {atMax && (
        <p className="interest-limit" role="status">
          <span aria-hidden="true">✓</span> That’s all {max} picked. To choose a different one, remove one of your picks above first.
        </p>
      )}
      {nudge > 0 && (
        <p key={nudge} className="interest-limit-toast" role="alert">
          You’ve already picked {max}. Remove one of your picks to choose this one.
        </p>
      )}

      {visible.length === 0 && <p className="hint">No interests match “{query}”.</p>}
      {visible.map((group) => {
        // Folded: the first few, plus anything already picked further down.
        const expanded = !!q || open.includes(group.label) || group.items.length <= FOLDED + 1
        const items = expanded ? group.items : group.items.filter((i, n) => n < FOLDED || selected.includes(i.id))
        const hidden = group.items.length - items.length
        return (
          <fieldset className="interest-group" key={group.label}>
            <legend>{group.label}</legend>
            <div className="chips chips-compact">
              {items.map((interest) => {
                const checked = selected.includes(interest.id)
                return (
                  <label className={!checked && atMax ? 'chip is-locked' : 'chip'} key={interest.id}>
                    <input type="checkbox" checked={checked} aria-disabled={!checked && atMax ? true : undefined} onChange={() => toggle(interest.id)} />
                    <span>{interest.label}</span>
                  </label>
                )
              })}
              {hidden > 0 && (
                <button
                  type="button"
                  className="chip-more"
                  onClick={() => setOpen([...open, group.label])}
                  aria-label={`Show ${hidden} more in ${group.label}`}
                >
                  +{hidden} more
                </button>
              )}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
