import { useEffect, useId, useMemo, useState } from 'react'
import type { Interest } from '../lib/profile'
import { shuffled } from '../lib/shuffle'
import { FieldError } from './Field'

type Props = {
  interests: Interest[]
  selected: number[]
  onChange: (next: number[]) => void
  max: number
  error?: string | null
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** One mixed list of interests with a search box. Each chip shows + until it's picked, then ✓. */
export function InterestPicker({ interests, selected, onChange, max, error }: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  // Mixed once when the page opens, so chips don't move while picking.
  const mixed = useMemo(() => shuffled(interests), [interests])
  const q = fold(query.trim())
  const visible = q ? mixed.filter((i) => fold(i.label).includes(q)) : mixed
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

      {visible.length === 0 ? (
        <p className="hint">No interests match “{query}”.</p>
      ) : (
        <fieldset className="interest-pool">
          <legend className="visually-hidden">Interests</legend>
          <div className="chips chips-compact">
            {visible.map((interest) => {
              const checked = selected.includes(interest.id)
              return (
                <label className={!checked && atMax ? 'chip chip-plus is-locked' : 'chip chip-plus'} key={interest.id}>
                  <input type="checkbox" checked={checked} aria-disabled={!checked && atMax ? true : undefined} onChange={() => toggle(interest.id)} />
                  <span>
                    <i aria-hidden="true">{checked ? '✓' : '+'}</i>
                    {interest.label}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      )}
    </div>
  )
}
