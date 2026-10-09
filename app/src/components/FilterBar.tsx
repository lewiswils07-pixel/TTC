import { useEffect, useId, useRef, useState } from 'react'
import { AgeRange } from './AgeRange'
import { DistanceSlider } from './DistanceSlider'
import { FieldError } from './Field'
import { Segmented } from './Segmented'
import { brand } from '../lib/brand'
import { messageOf } from '../lib/errors'
import { getFilters, saveFilters, type Filters } from '../lib/filters'
import { BUDGETS, MAX_PREF_AGE, MIN_AGE, PACES, SHOWN_GENDERS, TRAVEL_STYLES } from '../lib/options'
import { hasPlus } from '../lib/plan'
import { checkAgeRange } from '../lib/validation'

/** One Filters button at the top of Connect. It opens a sheet with every filter; "Show people" saves and refreshes who's shown. */
export function FilterButton({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const [filters, setFilters] = useState<Filters | null>(null)
  const [plus, setPlus] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    Promise.all([getFilters(userId), hasPlus()]).then(
      ([f, p]) => {
        setFilters({ ...f, age_max: Math.min(f.age_max, MAX_PREF_AGE) })
        setPlus(p)
      },
      () => setFilters(null),
    )
  }, [userId])

  return (
    <>
      <button type="button" className="filter-button" aria-haspopup="dialog" disabled={!filters} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M3 7h9m4 0h5M3 17h5m4 0h9M14 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm-4 10a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span className="filter-label">Filters</span>
      </button>
      {open && filters && (
        <FilterSheet
          start={filters}
          plus={plus}
          userId={userId}
          onClose={(saved) => {
            setOpen(false)
            if (saved) {
              setFilters(saved)
              onChanged()
            }
          }}
        />
      )}
    </>
  )
}

function FilterSheet({ start, plus, userId, onClose }: { start: Filters; plus: boolean; userId: string; onClose: (saved: Filters | null) => void }) {
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
  const gendersError = f.genders.length ? null : 'Choose at least one option.'
  const agesError = checkAgeRange([f.age_min, f.age_max])

  async function done() {
    if (gendersError || agesError) return
    setBusy(true)
    setError(null)
    try {
      await saveFilters(userId, { ...f, verified_only: false }) // ID checks don’t exist yet
      onClose(f)
    } catch (e) {
      setError(messageOf(e))
      setBusy(false)
    }
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
        <div className="sheet-head">
          <h2 id={title} className="confirm-title">
            Filters
          </h2>
          <button type="button" className="btn-link" onClick={() => setF({ ...f, age_min: MIN_AGE, age_max: MAX_PREF_AGE, max_distance_km: null, genders: SHOWN_GENDERS.map((g) => g.value), styles: [], paces: [], budgets: [] })}>
            Clear all
          </button>
        </div>
        <div className="sheet-body">
          <Segmented name="genders" legend="Show me" hint="Pick all that apply." options={SHOWN_GENDERS} selected={f.genders} onChange={(genders) => set({ genders })} multiple error={gendersError} />
          <AgeRange legend="Aged" min={MIN_AGE} max={MAX_PREF_AGE} value={[f.age_min, f.age_max]} onChange={([age_min, age_max]) => set({ age_min, age_max })} />
          <FieldError error={agesError} />
          <DistanceSlider km={f.max_distance_km} onChange={(max_distance_km) => set({ max_distance_km })} />
          <div className="section-head sheet-section">
            <h3 className="card-title">How they travel</h3>
            <span className="tag tag-plus">{brand.plusName}</span>
          </div>
          {!plus && (
            <p className="hint">
              These come with {brand.plusName}. You can set them now, and they’ll start working when you have {brand.plusName}.
            </p>
          )}
          <Segmented name="styles" legend="Planning" hint="Leave all off to see everyone." options={TRAVEL_STYLES} selected={f.styles} onChange={(styles) => set({ styles })} multiple />
          <Segmented name="paces" legend="Pace" options={PACES} selected={f.paces} onChange={(paces) => set({ paces })} multiple />
          <Segmented name="budgets" legend="Budget" options={BUDGETS} selected={f.budgets} onChange={(budgets) => set({ budgets })} multiple />
        </div>
        <FieldError error={error} />
        <div className="confirm-actions sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={() => onClose(null)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Show people'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
