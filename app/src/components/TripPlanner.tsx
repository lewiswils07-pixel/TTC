import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { CityPicks as Picks } from '../data/picks'
import { checkIdea, dayLabel, MAX_IDEA } from '../lib/board'
import { daysBetween } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { addTripIdea, deleteTripIdea, editTripIdea, tripPlan, updateTripIdea, type PlanItem } from '../lib/tripPlan'
import { CityPicks } from './CityPicks'
import { Dropdown } from './Dropdown'
import { FieldError } from './Field'

type Props = { tripId: number; city: string; start: string; end: string; picks?: Picks }

/** Your own day-by-day plan for a trip, with our picks to add from
 *  (Lewis, 7 Oct: a trip planner on your own trips). */
export function TripPlanner({ tripId, city, start, end, picks }: Props) {
  const days = Math.min(daysBetween(start, end) + 1, 91)
  const [items, setItems] = useState<PlanItem[] | null>(null)
  const [title, setTitle] = useState('')
  const [day, setDay] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [removed, setRemoved] = useState<PlanItem | null>(null)
  const [editing, setEditing] = useState<number | null>(null)

  const reload = useCallback(() => tripPlan(tripId).then(setItems), [tripId])
  // The Undo offer goes after a while.
  useEffect(() => {
    if (!removed) return
    const t = window.setTimeout(() => setRemoved(null), 8000)
    return () => window.clearTimeout(t)
  }, [removed])
  useEffect(() => {
    reload().catch((e) => setError(messageOf(e)))
  }, [reload])

  async function run(action: () => Promise<void>, message: string) {
    setError(null)
    try {
      await action()
      setStatus(message)
    } catch (e) {
      setError(messageOf(e))
    } finally {
      await reload().catch(() => undefined)
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (checkIdea(title)) return
    setBusy(true)
    const t = title.trim()
    await run(() => addTripIdea(tripId, t, day ? Number(day) : null, null), `${t} added to your plan.`)
    setTitle('')
    setTried(false)
    setBusy(false)
  }

  if (!items) return error ? <p className="notice notice-error">{error}</p> : <div className="skeleton-block" aria-hidden="true" />

  const byDay = new Map<number | null, PlanItem[]>()
  for (const i of items) byDay.set(i.day, [...(byDay.get(i.day) ?? []), i])
  const groups = [...byDay.entries()].sort(([a], [b]) => (a ?? 999) - (b ?? 999))
  const ideaError = tried ? checkIdea(title) : null
  const done = items.filter((i) => i.done).length

  return (
    <div className="trip-planner">
      <p className="visually-hidden" role="status">
        {status}
      </p>
      {removed && (
        <p className="feed-toast plan-toast">
          <span>{removed.title} removed.</span>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              const item = removed
              setRemoved(null)
              void run(() => addTripIdea(tripId, item.title, item.day, item.source_url), `${item.title} is back on your plan.`)
            }}
          >
            Undo
          </button>
        </p>
      )}
      <form className="card plan-add" onSubmit={add} noValidate aria-label="Add to your plan">
        <label htmlFor="plan-title" className="plan-add-label">
          Add something to do
        </label>
        <div className="plan-add-row">
          <input
            id="plan-title"
            className="input"
            maxLength={MAX_IDEA}
            placeholder="For example, sunset at a viewpoint"
            value={title}
            aria-invalid={!!ideaError || undefined}
            aria-describedby={ideaError ? 'plan-title-error' : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
        <FieldError id="plan-title-error" error={ideaError} />
        <Dropdown
          id="plan-day"
          label="Day"
          value={day}
          placeholder="Any day"
          groups={[{ options: [{ value: '', label: 'Any day' }, ...Array.from({ length: days }, (_, i) => ({ value: String(i + 1), label: dayLabel(i + 1, start) }))] }]}
          onChange={setDay}
        />
      </form>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="hint section-hint">Nothing planned yet. Add your own ideas above{picks ? ', or pick from ours below' : ''}.</p>
      ) : (
        <>
          <p className="plan-progress">
            {done} of {items.length} done
          </p>
          {groups.map(([d, list]) => (
            <section key={d ?? 'any'} className="plan-day" aria-label={d ? dayLabel(d, start) : 'Any day'}>
              <h3 className="plan-day-title">{d ? dayLabel(d, start) : 'Any day'}</h3>
              <ul className="plan-items">
                {list.map((item) =>
                  editing === item.id ? (
                    <li key={item.id} className="plan-item is-editing">
                      <IdeaEditor
                        item={item}
                        days={days}
                        start={start}
                        onCancel={() => setEditing(null)}
                        onSave={async (t, d) => {
                          setEditing(null)
                          setItems((all) => all && all.map((x) => (x.id === item.id ? { ...x, title: t, day: d } : x)))
                          await run(() => editTripIdea(item.id, t, d), `${t} saved.`)
                        }}
                      />
                    </li>
                  ) : (
                    <li key={item.id} className={item.done ? 'plan-item is-done' : 'plan-item'}>
                      <input
                        type="checkbox"
                        className="plan-item-check"
                        checked={item.done}
                        aria-label={item.done ? `Done: ${item.title}` : `Mark ${item.title} done`}
                        onChange={(e) => {
                          const on = e.target.checked
                          setItems((all) => all && all.map((x) => (x.id === item.id ? { ...x, done: on } : x)))
                          void run(() => updateTripIdea(item, { done: on }), on ? `Ticked off ${item.title}.` : `${item.title} is back on your plan.`)
                        }}
                      />
                      <span className="plan-item-title">{item.title}</span>
                      {item.source_url && (
                        <a className="idea-link" href={item.source_url} target="_blank" rel="noopener noreferrer">
                          Open<span className="visually-hidden"> {item.title} (opens in a new tab)</span>
                        </a>
                      )}
                      <button type="button" className="btn-link plan-edit" aria-label={`Edit ${item.title}`} onClick={() => setEditing(item.id)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="icon-btn plan-remove"
                        aria-label={`Remove ${item.title}`}
                        onClick={() => {
                          setItems((all) => all && all.filter((x) => x.id !== item.id))
                          setRemoved(item)
                          void run(() => deleteTripIdea(item.id), `${item.title} removed. You can undo this.`)
                        }}
                      >
                        ×
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </>
      )}

      {picks ? (
        <CityPicks
          picks={picks}
          added={items.map((i) => i.title)}
          onAdd={(t, url) => run(() => addTripIdea(tripId, t, null, url), `${t} added to your plan.`)}
        />
      ) : (
        <p className="hint section-hint">We haven’t written our picks for {city} yet, so add your own ideas above.</p>
      )}
    </div>
  )
}

/** Change an idea's words and day, in place. */
export function IdeaEditor({
  item,
  days,
  start,
  onSave,
  onCancel,
  canEditTitle = true,
}: {
  item: { id: number; title: string; day: number | null }
  days: number
  start: string | null
  onSave: (title: string, day: number | null) => void
  onCancel: () => void
  canEditTitle?: boolean
}) {
  const [title, setTitle] = useState(item.title)
  const [day, setDay] = useState(item.day ? String(item.day) : '')
  const error = checkIdea(title)
  return (
    <form
      className="idea-editor"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!error) onSave(title.trim(), day ? Number(day) : null)
      }}
    >
      {canEditTitle && (
        <>
          <label htmlFor={`idea-${item.id}`} className="visually-hidden">
            Idea
          </label>
          <input id={`idea-${item.id}`} className="input" maxLength={MAX_IDEA} value={title} autoFocus aria-invalid={!!error || undefined} onChange={(e) => setTitle(e.target.value)} />
          <FieldError error={error} />
        </>
      )}
      <Dropdown
        id={`idea-day-${item.id}`}
        label="Day"
        value={day}
        placeholder="Any day"
        groups={[{ options: [{ value: '', label: 'Any day' }, ...Array.from({ length: days }, (_, i) => ({ value: String(i + 1), label: dayLabel(i + 1, start) }))] }]}
        onChange={setDay}
      />
      <div className="action-row">
        <button type="button" className="btn btn-secondary btn-small" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-small">
          Save
        </button>
      </div>
    </form>
  )
}
