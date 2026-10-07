import { useId, useState } from 'react'
import { addDays, dateReadback, daysBetween, isoDate } from '../lib/dates'
import { FieldError } from './Field'

const fullDay = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthTitle = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

type Props = {
  start: string
  end: string
  /** Earliest and latest days that can be picked. */
  min: string
  max: string
  /** Longest trip, in days. */
  maxDays: number
  onChange: (start: string, end: string) => void
  error?: string | null
}

/** Pick a trip's dates on a calendar: tap the first day, then the last
 *  (Lewis, 7 Oct: trip planning should be easier than two date boxes). */
export function DateRangePicker({ start, end, min, max, maxDays, onChange, error }: Props) {
  const [month, setMonth] = useState(() => (start || min).slice(0, 7) + '-01')
  const titleId = useId()
  const legendId = useId()
  const errorId = useId()
  const choosingEnd = !!start && !end

  const first = month
  // Monday-first grid: blanks before the 1st.
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
  const nextMonth = isoDate(new Date(Number(first.slice(0, 4)), Number(first.slice(5, 7)), 1))
  const days = daysBetween(first, nextMonth)
  const prevMonth = isoDate(new Date(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 2, 1))
  const lastAllowed = choosingEnd ? minIso(max, addDays(start, maxDays - 1)) : max

  function pick(day: string) {
    if (!start || end || day < start) onChange(day, '')
    else onChange(start, day)
  }

  const readback = dateReadback(start, end)
  return (
    <div className="field range-picker" data-field="start" data-invalid={error ? 'true' : undefined} role="group" aria-labelledby={legendId}>
      <p className="range-picker-legend" id={legendId}>
        When are you going?
      </p>
      <div className="range-picker-head">
        <button type="button" className="icon-btn" aria-label="Previous month" disabled={first <= min.slice(0, 7) + '-01'} onClick={() => setMonth(prevMonth)}>
          ‹
        </button>
        <h3 id={titleId} aria-live="polite">
          {monthTitle.format(new Date(`${first}T00:00:00Z`))}
        </h3>
        <button type="button" className="icon-btn" aria-label="Next month" disabled={nextMonth > max} onClick={() => setMonth(nextMonth)}>
          ›
        </button>
      </div>
      <div className="range-grid" role="group" aria-labelledby={titleId} aria-describedby={error ? errorId : undefined}>
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="range-weekday" aria-hidden="true">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = addDays(first, i)
          const ends = day === start || day === end
          const inRange = start && end && day > start && day < end
          const off = day < min || day > lastAllowed
          return (
            <button
              key={day}
              type="button"
              className={['range-day', ends && 'is-end', inRange && 'is-in', day === start && end && 'is-start', day === end && 'is-last'].filter(Boolean).join(' ')}
              aria-label={fullDay.format(new Date(`${day}T00:00:00Z`))}
              aria-pressed={ends}
              disabled={off}
              onClick={() => pick(day)}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <p className={readback ? 'range-readback' : 'hint range-readback'} aria-live="polite">
        {readback ?? (choosingEnd ? 'Now tap your last day.' : 'Tap your first day.')}
      </p>
      <FieldError id={errorId} error={error} />
    </div>
  )
}

const minIso = (a: string, b: string) => (a < b ? a : b)
