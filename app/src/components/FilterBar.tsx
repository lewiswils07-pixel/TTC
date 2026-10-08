import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AgeRange } from './AgeRange'
import { DistanceSlider } from './DistanceSlider'
import { FieldError } from './Field'
import { Segmented } from './Segmented'
import { brand } from '../lib/brand'
import { messageOf } from '../lib/errors'
import { getFilters, saveFilters, type Filters } from '../lib/filters'
import { BUDGETS, DISTANCE_MILES, distanceLabel, distanceStop, MAX_PREF_AGE, MIN_AGE, PACES, SHOWN_GENDERS, TRAVEL_STYLES } from '../lib/options'
import { hasPlus } from '../lib/plan'
import { checkAgeRange } from '../lib/validation'

type Key = 'age' | 'distance' | 'genders' | 'styles' | 'paces' | 'budgets'

const PLUS_KEYS: Key[] = ['styles', 'paces', 'budgets']
const TITLES: Record<Key, string> = {
  age: 'Age',
  distance: 'Distance',
  genders: 'Show me',
  styles: 'Planning',
  paces: 'Pace',
  budgets: 'Budget',
}

/** A short pill label: the filter's name, or what it's set to. */
function pillLabel(key: Key, f: Filters): { text: string; set: boolean } {
  switch (key) {
    case 'age': {
      const set = f.age_min > MIN_AGE || f.age_max < MAX_PREF_AGE
      return { text: set ? `Age ${f.age_min}–${f.age_max >= MAX_PREF_AGE ? `${MAX_PREF_AGE}+` : f.age_max}` : 'Age', set }
    }
    case 'distance': {
      const miles = DISTANCE_MILES[distanceStop(f.max_distance_km)]
      return miles === null ? { text: 'Distance', set: false } : { text: distanceLabel(miles).replace('Up to ', ''), set: true }
    }
    case 'genders': {
      const set = f.genders.length > 0 && f.genders.length < SHOWN_GENDERS.length
      const first = SHOWN_GENDERS.find((g) => g.value === f.genders[0])?.label
      return { text: set && first ? (f.genders.length > 1 ? `${first} +${f.genders.length - 1}` : first) : 'Show me', set }
    }
    default: {
      const list = f[key]
      const options = key === 'styles' ? TRAVEL_STYLES : key === 'paces' ? PACES : BUDGETS
      const first = options.find((o) => o.value === list[0])?.label
      return { text: list.length && first ? (list.length > 1 ? `${first} +${list.length - 1}` : first) : TITLES[key], set: list.length > 0 }
    }
  }
}

/** Filter pills across the top of Connections. Each opens a small sheet; "Done" saves and refreshes the people shown. */
export function FilterBar({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const [filters, setFilters] = useState<Filters | null>(null)
  const [plus, setPlus] = useState(false)
  const [open, setOpen] = useState<Key | null>(null)

  useEffect(() => {
    Promise.all([getFilters(userId), hasPlus()]).then(
      ([f, p]) => {
        setFilters({ ...f, age_max: Math.min(f.age_max, MAX_PREF_AGE) })
        setPlus(p)
      },
      () => setFilters(null),
    )
  }, [userId])

  const keys: Key[] = ['age', 'distance', 'genders', 'styles', 'paces', 'budgets']
  return (
    <div className="filter-bar" role="group" aria-label="Filters">
      <Link className="filter-all" to="/filters" aria-label="All filters">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M3 7h9m4 0h5M3 17h5m4 0h9M14 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm-4 10a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </Link>
      {keys.map((key) => {
        const { text, set } = filters ? pillLabel(key, filters) : { text: TITLES[key], set: false }
        return (
          <button
            key={key}
            type="button"
            className={set ? 'filter-pill is-set' : 'filter-pill'}
            aria-haspopup="dialog"
            aria-label={set ? `${TITLES[key]}: ${text}` : TITLES[key]}
            disabled={!filters}
            onClick={() => setOpen(key)}
          >
            {text}
            {PLUS_KEYS.includes(key) && !plus && <span className="filter-plus" aria-hidden="true">+</span>}
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <path d="m2.5 4.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )
      })}
      {open && filters && (
        <FilterSheet
          which={open}
          start={filters}
          locked={PLUS_KEYS.includes(open) && !plus}
          onClose={(saved) => {
            setOpen(null)
            if (saved) {
              setFilters(saved)
              onChanged()
            }
          }}
          userId={userId}
        />
      )}
    </div>
  )
}

function FilterSheet({ which, start, locked, userId, onClose }: { which: Key; start: Filters; locked: boolean; userId: string; onClose: (saved: Filters | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const title = useId()
  const [f, setF] = useState(start)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const before = document.activeElement as HTMLElement | null
    if (typeof d.showModal === 'function') d.showModal()
    else d.setAttribute('open', '')
    return () => before?.focus?.()
  }, [])

  const set = (change: Partial<Filters>) => setF({ ...f, ...change })
  const check = which === 'age' ? checkAgeRange([f.age_min, f.age_max]) : which === 'genders' && !f.genders.length ? 'Choose at least one option.' : null

  async function done() {
    if (check) return
    setBusy(true)
    setError(null)
    try {
      await saveFilters(userId, { ...f, verified_only: false })
      onClose(f)
    } catch (e) {
      setError(messageOf(e))
      setBusy(false)
    }
  }

  let control: ReactNode
  switch (which) {
    case 'age':
      control = <AgeRange legend="Aged" min={MIN_AGE} max={MAX_PREF_AGE} value={[f.age_min, f.age_max]} onChange={([age_min, age_max]) => set({ age_min, age_max })} />
      break
    case 'distance':
      control = <DistanceSlider km={f.max_distance_km} onChange={(max_distance_km) => set({ max_distance_km })} />
      break
    case 'genders':
      control = <Segmented name="genders" legend="Show me" hint="Pick all that apply." options={SHOWN_GENDERS} selected={f.genders} onChange={(genders) => set({ genders })} multiple />
      break
    case 'styles':
      control = <Segmented name="styles" legend="Planning" hint="Leave all off to see everyone." options={TRAVEL_STYLES} selected={f.styles} onChange={(styles) => set({ styles })} multiple />
      break
    case 'paces':
      control = <Segmented name="paces" legend="Pace" hint="Leave all off to see everyone." options={PACES} selected={f.paces} onChange={(paces) => set({ paces })} multiple />
      break
    case 'budgets':
      control = <Segmented name="budgets" legend="Budget" hint="Leave all off to see everyone." options={BUDGETS} selected={f.budgets} onChange={(budgets) => set({ budgets })} multiple />
      break
  }

  return (
    <dialog
      ref={ref}
      className="confirm sheet"
      aria-labelledby={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose(null)
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(null)
      }}
    >
      <form
        className="confirm-box sheet-box"
        onSubmit={(e) => {
          e.preventDefault()
          void done()
        }}
        noValidate
      >
        <span className="sheet-handle" aria-hidden="true" />
        <h2 id={title} className="confirm-title">
          {TITLES[which]}
        </h2>
        {locked && (
          <p className="hint">
            This comes with {brand.plusName}. You can set it now, and it starts working when you have {brand.plusName}.
          </p>
        )}
        {control}
        <FieldError error={check ?? error} />
        <div className="confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={() => onClose(null)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Done'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
