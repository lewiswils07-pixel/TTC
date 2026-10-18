import { useEffect, useId, useRef, useState } from 'react'
import { FieldError } from './Field'
import { FilterFields } from './FilterFields'
import { CloseIcon } from './Icons'
import { messageOf } from '../lib/errors'
import { NO_PLUS_FILTERS, filterErrors, getFilters, saveFilters, type Filters } from '../lib/filters'
import { MAX_PREF_AGE, MIN_AGE, SHOWN_GENDERS } from '../lib/options'
import { hasPlus } from '../lib/plan'

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

  const errors = filterErrors(f)

  async function done() {
    if (errors.genders || errors.ages) return
    setBusy(true)
    setError(null)
    try {
      await saveFilters(userId, f)
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
          <button
            type="button"
            className="btn-link"
            onClick={() =>
              setF({
                ...f,
                age_min: MIN_AGE,
                age_max: MAX_PREF_AGE,
                max_distance_km: null,
                genders: SHOWN_GENDERS.map((g) => g.value),
                age_flexible: false,
                distance_flexible: false,
                ...NO_PLUS_FILTERS,
              })
            }
          >
            Reset
          </button>
          <button type="button" className="icon-btn sheet-close" aria-label="Close filters" onClick={() => onClose(null)}>
            <CloseIcon size={22} />
          </button>
        </div>
        <div className="sheet-body">
          <FilterFields value={f} onChange={setF} plus={plus} />
        </div>
        <FieldError error={error} />
        <div className="confirm-actions sheet-actions">
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Saving…' : 'Show people'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
