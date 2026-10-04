import { useId, useMemo, useState } from 'react'
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

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Interests grouped by category, with a search box and compact tappable chips. */
export function InterestPicker({ interests, selected, onChange, max, error }: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  const groups = useMemo(() => groupInterests(interests), [interests])
  const q = fold(query.trim())
  const visible = q ? groups.map((g) => ({ ...g, items: g.items.filter((i) => fold(i.label).includes(q)) })).filter((g) => g.items.length) : groups
  const atMax = selected.length >= max
  const chosen = interests.filter((i) => selected.includes(i.id))

  const toggle = (interestId: number) =>
    onChange(selected.includes(interestId) ? selected.filter((v) => v !== interestId) : [...selected, interestId])

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
      {atMax && <p className="hint">You’ve picked {max}, the most allowed. Remove one to choose another.</p>}

      {visible.length === 0 && <p className="hint">No interests match “{query}”.</p>}
      {visible.map((group) => (
        <fieldset className="interest-group" key={group.label}>
          <legend>{group.label}</legend>
          <div className="chips chips-compact">
            {group.items.map((interest) => {
              const checked = selected.includes(interest.id)
              return (
                <label className="chip" key={interest.id}>
                  <input type="checkbox" checked={checked} disabled={!checked && atMax} onChange={() => toggle(interest.id)} />
                  <span>{interest.label}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
