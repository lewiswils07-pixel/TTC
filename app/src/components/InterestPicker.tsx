import { useEffect, useId, useMemo, useState } from 'react'
import type { Interest } from '../lib/profile'
import { FieldError } from './Field'
import { Check } from 'lucide-react'

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

/** The first chips everyone sees (Claude Design, 17 Oct); the rest are a tap away. Picks always show. */
const STARTERS = [
  'food-markets',
  'walking',
  'wine',
  'art-galleries',
  'live-music',
  'gardens',
  'history',
  'photography',
  'hiking',
  'theatre',
  'beaches',
  'architecture',
  'cooking-classes',
  'wildlife',
  'museums',
  'local-cuisine',
  'football',
  'festivals',
  'backpacking',
]

function matches(i: Interest, q: string): boolean {
  if (fold(i.label).includes(q) || i.slug.includes(q) || (i.category_label && fold(i.category_label).includes(q))) return true
  return Object.entries(ALSO).some(([word, slugs]) => word.startsWith(q) && q.length >= 3 && slugs.includes(i.slug))
}

/** Interests as a cloud of chips with a tick once picked (Claude Design, 17 Oct): a short list first,
 *  then every interest by group with a search box. */
export function InterestPicker({ interests, selected, onChange, max, error }: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const q = fold(query.trim())
  const starters = useMemo(() => {
    const list = interests.filter((i) => STARTERS.includes(i.slug)).sort((a, b) => STARTERS.indexOf(a.slug) - STARTERS.indexOf(b.slug))
    return list.length >= 6 ? list : interests.slice(0, STARTERS.length)
  }, [interests])
  const groups = useMemo(() => {
    const map = new Map<string, Interest[]>()
    for (const i of q ? interests.filter((x) => matches(x, q)) : interests) {
      const key = i.category_label ?? 'More'
      map.set(key, [...(map.get(key) ?? []), i])
    }
    return [...map.entries()]
  }, [interests, q])
  const atMax = selected.length >= max

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
      <label className={!checked && atMax ? 'pick-chip is-locked' : 'pick-chip'} key={interest.id}>
        <input type="checkbox" checked={checked} aria-disabled={!checked && atMax ? true : undefined} onChange={() => toggle(interest.id)} />
        <span>
          {checked && <Check size={18} strokeWidth={2.4} aria-hidden="true" />}
          {interest.label}
        </span>
      </label>
    )
  }
  const shown = [...starters, ...interests.filter((i) => selected.includes(i.id) && !starters.includes(i))]

  return (
    <div className="interests" data-field="interests">
      <p className={atMax ? 'interest-count is-full' : 'interest-count'} role="status">
        Pick up to {max} · <strong>{selected.length}</strong> picked
      </p>
      <FieldError error={error} />
      {nudge > 0 && (
        <p key={nudge} className="interest-limit-toast" role="alert">
          You’ve already picked {max}. Remove one of your picks to choose this one.
        </p>
      )}

      {!all ? (
        <fieldset className="pick-cloud">
          <legend className="visually-hidden">Interests</legend>
          <div className="pick-chips">{shown.map(chip)}</div>
          <button type="button" className="btn-link interest-more" aria-expanded={false} onClick={() => setAll(true)}>
            See all {interests.length} interests
          </button>
        </fieldset>
      ) : (
        <>
          <div className="field interest-search">
            <label htmlFor={`${id}-search`} className="visually-hidden">
              Search interests
            </label>
            <input
              id={`${id}-search`}
              className="input input-search"
              type="search"
              placeholder="Search, for example history or walking"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {groups.length === 0 && <p className="hint">No interests match “{query}”.</p>}
          {groups.map(([group, list]) => (
            <fieldset className="pick-cloud" key={group}>
              <legend className="pick-group">{group}</legend>
              <div className="pick-chips">{list.map(chip)}</div>
            </fieldset>
          ))}
          <button
            type="button"
            className="btn-link interest-more"
            aria-expanded={true}
            onClick={() => {
              setAll(false)
              setQuery('')
            }}
          >
            Show fewer
          </button>
        </>
      )}
    </div>
  )
}
