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

/** Other words people search with, and the interests they mean (by slug). */
const ALSO: Record<string, string[]> = {
  cinema: ['film'],
  movies: ['film'],
  theater: ['theatre'],
  reading: ['literature'],
  singing: ['choir', 'music-making'],
  games: ['quizzes-games', 'gaming'],
  football: ['watching-sport'],
  rugby: ['watching-sport'],
  drinks: ['wine', 'cocktails', 'whisky-spirits', 'craft-beer', 'traditional-pubs'],
  beer: ['craft-beer', 'traditional-pubs'],
  sea: ['beaches', 'sailing', 'snorkelling', 'ocean-cruises'],
  boats: ['boat-trips', 'sailing', 'river-cruises', 'ocean-cruises'],
  churches: ['sacred-sites'],
  heritage: ['history', 'castles-stately-homes', 'stately-homes', 'archaeology'],
  nature: ['wildlife', 'birdwatching', 'national-parks', 'gardens'],
  food: ['local-cuisine', 'fine-dining', 'street-food', 'food-markets', 'cooking-classes'],
  wellbeing: ['spa', 'yoga', 'pilates', 'meditation'],
  sewing: ['crafts', 'knitting'],
}

function matches(i: Interest, q: string): boolean {
  if (fold(i.label).includes(q) || i.slug.includes(q) || (i.category_label && fold(i.category_label).includes(q))) return true
  return Object.entries(ALSO).some(([word, slugs]) => word.startsWith(q) && q.length >= 3 && slugs.includes(i.slug))
}

/** The same mixed order every time, so chips don't jump between visits (testers). */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One mixed list of interests with a search box. Each chip shows + until it's picked, then ✓. */
export function InterestPicker({ interests, selected, onChange, max, error }: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [byType, setByType] = useState(false)
  // One mixed list (Lewis, 6 Oct), in the same order every time.
  const mixed = useMemo(() => shuffled(interests, seeded(7)), [interests])
  const q = fold(query.trim())
  const visible = q ? mixed.filter((i) => matches(i, q)) : mixed
  const types = useMemo(() => {
    const groups = new Map<string, Interest[]>()
    for (const i of interests) {
      const key = i.category_label ?? 'More'
      groups.set(key, [...(groups.get(key) ?? []), i])
    }
    return [...groups.entries()]
  }, [interests])
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

  const chip = (interest: Interest) => {
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
  }

  return (
    <div className="interests" data-field="interests">
      <div className="field">
        <label htmlFor={`${id}-search`}>Search interests</label>
        <input
          id={`${id}-search`}
          className="input input-search"
          type="search"
          placeholder="For example, history or walking"
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

      <div className="interest-view" role="group" aria-label="Show interests">
        <button type="button" className={byType ? 'pill' : 'pill is-on'} aria-pressed={!byType} onClick={() => setByType(false)}>
          Mixed
        </button>
        <button type="button" className={byType ? 'pill is-on' : 'pill'} aria-pressed={byType} onClick={() => setByType(true)}>
          By type
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="hint">No interests match “{query}”.</p>
      ) : byType && !q ? (
        types.map(([type, list]) => (
          <fieldset className="interest-pool" key={type}>
            <legend className="interest-type">{type}</legend>
            <div className="chips chips-compact">{list.map(chip)}</div>
          </fieldset>
        ))
      ) : (
        <fieldset className="interest-pool">
          <legend className="visually-hidden">Interests</legend>
          <div className="chips chips-compact">{visible.map(chip)}</div>
        </fieldset>
      )}
    </div>
  )
}
