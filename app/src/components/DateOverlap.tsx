import { addDays, daysBetween, shortDates } from '../lib/dates'
import { bestDays, type Stay } from '../lib/overlap'

const MAX_LANES = 6
const dayNumber = (iso: string) => String(Number(iso.slice(8, 10)))
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' })

/** Everyone's dates on one timeline, with the best days to meet picked out
 *  (like the "Lisbon · May" picture on the website). */
export function DateOverlap({ city, mine, others }: { city: string; mine: Stay; others: (Stay & { name: string })[] }) {
  const lanes = others.slice(0, MAX_LANES)
  const all = [mine, ...lanes]
  const from = all.reduce((a, s) => (s.start < a ? s.start : a), mine.start)
  const to = all.reduce((a, s) => (s.end > a ? s.end : a), mine.end)
  const total = daysBetween(from, to) + 1
  const pct = (iso: string) => (daysBetween(from, iso) / total) * 100
  const width = (s: Stay) => ((daysBetween(s.start, s.end) + 1) / total) * 100
  // Up to 6 day labels, evenly spread.
  const step = Math.max(1, Math.ceil(total / 6))
  const ticks = Array.from({ length: Math.ceil(total / step) }, (_, i) => addDays(from, i * step))
  const months = [...new Set([from, to].map((d) => monthName.format(new Date(`${d}T00:00:00Z`))))].join('–')
  const best = bestDays(mine, lanes)
  const summary = best
    ? `${shortDates(best.start, best.end)}: ${best.count === 1 ? 'you’re both there' : `${best.count + 1} of you are there`}`
    : 'No one is there on your exact dates yet'

  return (
    <figure className="overlap card" aria-label={`Who’s in ${city} when. ${summary}.`}>
      <p className="overlap-label" aria-hidden="true">
        {city} · {months}
      </p>
      <div className="overlap-chart" aria-hidden="true">
        <div className="overlap-row overlap-ticks">
          <span />
          <div className="overlap-lane">
            {ticks.map((t) => (
              <small key={t} style={{ left: `${pct(t)}%` }}>
                {dayNumber(t)}
              </small>
            ))}
          </div>
        </div>
        {best && (
          <div className="overlap-band-wrap">
            <span />
            <div className="overlap-lane">
              <i className="overlap-band" style={{ left: `${pct(best.start)}%`, width: `${width(best)}%` }} />
            </div>
          </div>
        )}
        {[{ ...mine, name: 'You' }, ...lanes].map((s, i) => (
          <div className="overlap-row" key={`${s.name}-${i}`}>
            <span className="overlap-name">{s.name}</span>
            <div className="overlap-lane overlap-track">
              <i className={i === 0 ? 'overlap-bar is-me' : 'overlap-bar'} style={{ left: `${pct(s.start)}%`, width: `${width(s)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <figcaption className="overlap-foot">
        {best ? (
          <>
            <b>{shortDates(best.start, best.end)}:</b> {best.count === 1 ? 'you’re both there' : `${best.count + 1} of you are there`}
          </>
        ) : (
          summary
        )}
      </figcaption>
    </figure>
  )
}
