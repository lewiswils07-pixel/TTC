import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Layout } from '../components/Layout'
import { goingWhenYouAre } from '../components/SameTimeStrip'
import { SkeletonRows } from '../components/Skeleton'
import { brand } from '../lib/brand'
import { addDays, daysBetween, shortDates } from '../lib/dates'
import { count } from '../lib/rules'
import { listMyTrips, type Trip } from '../lib/trips'
import { Gem } from 'lucide-react'
import { messageOf } from '../lib/errors'
import { loadFeed, sameTime, type FeedPerson } from '../lib/feed'
import { ageLabel } from '../lib/options'
import { hasPlus, plusLink, plusPrice } from '../lib/plan'
import { BackIcon } from '../components/Icons'

/** Everyone here grouped under the member's trip they share, with the days you're both there. */
function byTrip(people: FeedPerson[]) {
  const trips = new Map<number, { tripId: number; city: string; people: { person: FeedPerson; days: { start: string; end: string } | null }[] }>()
  for (const p of people) {
    const trip = sameTime(p)!
    const entry = trips.get(p.trip_id!) ?? { tripId: p.trip_id!, city: trip.city, people: [] }
    entry.people.push({ person: p, days: trip.days })
    trips.set(p.trip_id!, entry)
  }
  return [...trips.values()]
}

/** Up to two weeks of days, from your trip's first day, each marked when you're both there. */
function DayStrip({ mine, days }: { mine: Trip; days: { start: string; end: string } }) {
  const total = Math.min(daysBetween(mine.start_date, mine.end_date) + 1, 14)
  const list = Array.from({ length: total }, (_, i) => addDays(mine.start_date, i))
  return (
    <ol className="day-strip" aria-hidden="true">
      {list.map((d) => {
        const together = d >= days.start && d <= days.end
        const date = new Date(`${d}T00:00:00Z`)
        return (
          <li key={d} className={together ? 'is-together' : undefined}>
            <span>{date.toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'UTC' })}</span>
            <strong>{date.getUTCDate()}</strong>
          </li>
        )
      })}
    </ol>
  )
}

/** Sodalis+: everyone going to the same place as you, at the same time, with the days you overlap (Claude Design, 15 Oct). */
export function SameTime() {
  const heading = useRef<HTMLHeadingElement>(null)
  const [plus, setPlus] = useState<boolean | null>(null)
  const [people, setPeople] = useState<FeedPerson[] | null>(null)
  const [myTrips, setMyTrips] = useState<Trip[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    heading.current?.focus()
    listMyTrips().then(
      (t) => setMyTrips(t ?? []),
      () => {},
    )
    hasPlus().then((p) => {
      setPlus(p)
      if (p)
        loadFeed().then(
          (list) => setPeople(goingWhenYouAre(list)),
          (e) => setError(messageOf(e)),
        )
    })
  }, [])

  const groups = people ? byTrip(people) : []
  const current = groups.find((g) => g.tripId === picked) ?? groups[0]
  const mine = current && myTrips.find((t) => t.id === current.tripId)

  return (
    <Layout tab="connections">
      <div className="same-page">
        <div className="same-head">
          <div className="same-top">
            <Link className="icon-btn" to="/connections" aria-label="Back to Who’s going">
              <BackIcon />
            </Link>
            <span className="tag tag-plus tag-plus-dark">
              <Gem size={16} strokeWidth={2} aria-hidden="true" />
              {brand.plusName}
            </span>
          </div>
          <h1 ref={heading} tabIndex={-1}>
            Going when you are
          </h1>
          <p className="lede">Members going to the same place as you, at the same time.</p>
          {groups.length > 1 && (
            <div className="same-trips" role="group" aria-label="Your trips">
              {groups.map((g) => {
                const t = myTrips.find((m) => m.id === g.tripId)
                return (
                  <button key={g.tripId} type="button" className={g === current ? 'same-trip is-current' : 'same-trip'} aria-pressed={g === current} onClick={() => setPicked(g.tripId)}>
                    {g.city}
                    {t && ` · ${shortDates(t.start_date, t.end_date)}`}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {plus === false ? (
          <div className="plus-offer">
            <p className="lede">See every member going to the same place as you, at the same time, so you can plan to meet up while you’re both there.</p>
            <p className="plus-offer-price">
              Comes with {brand.plusName}, <strong>{plusPrice()}</strong> a month. You can stop at any time.
            </p>
            <Link className="btn btn-primary btn-lg" to={plusLink('same_time')}>
              Get {brand.plusName}
            </Link>
            <Link className="btn btn-secondary btn-lg" to="/connections">
              Not now
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}
            {!people && !error && <SkeletonRows rows={3} label="Finding trips in common…" />}
            {people && people.length === 0 && <p className="hint">No one yet. We’ll show members here as soon as someone books the same place and dates as you.</p>}
            {current && (
              <section aria-labelledby="same-count">
                <div className="same-count-row">
                  <h2 id="same-count">{current.people.length === 1 ? '1 member overlaps' : `${current.people.length} members overlap`}</h2>
                  {mine && (
                    <p className="same-legend" aria-hidden="true">
                      <span className="is-together" /> Together <span /> Apart
                    </p>
                  )}
                </div>
                <ul className="same-people">
                  {current.people.map(({ person: p, days }) => {
                    const theirs = p.trips.find((t) => t.mine === current.tripId)
                    return (
                      <li key={p.profile_id} className="card same-person">
                        <div className="same-person-head">
                          <Avatar name={p.display_name} path={p.photo_path} size="lg" />
                          <span className="same-person-text">
                            <strong>
                              {p.display_name}
                              {p.birth_year ? `, ${ageLabel(p.birth_year)}` : ''}
                            </strong>
                            <span>{[p.home_city, theirs?.exact ? `there ${shortDates(theirs.start, theirs.end)}` : null].filter(Boolean).join(' · ')}</span>
                          </span>
                          <Link className="btn btn-primary btn-small" to={`/connections?person=${p.profile_id}`} aria-label={`See ${p.display_name}’s card`}>
                            View
                          </Link>
                        </div>
                        {days && (
                          <>
                            <p className="same-together">
                              Together {shortDates(days.start, days.end)} · <span>{count(daysBetween(days.start, days.end) + 1, 'day')}</span>
                            </p>
                            {mine && <DayStrip mine={mine} days={days} />}
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
