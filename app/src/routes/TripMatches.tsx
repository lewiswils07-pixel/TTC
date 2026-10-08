import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { CityReviews } from '../components/CityReviews'
import { DateOverlap } from '../components/DateOverlap'
import { TripPlanner } from '../components/TripPlanner'
import { RequestsHint, SuggestionCard, useRequests } from '../components/Suggestions'
import { picksFor } from '../data/picks'
import { cityLabel } from '../lib/cities'
import { isoDate, tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { noteFirstMatch } from '../lib/kpis'
import { homeLabel, reasons, suggestForTrip, tripCompanions, type TripCompanion, type TripSuggestion } from '../lib/matching'
import { ageLabel } from '../lib/options'
import { Avatar } from '../components/Avatar'
import { flexibilityLabel, getTrip, type Trip } from '../lib/trips'

type Tab = 'people' | 'plan' | 'reviews'
const TABS: { key: Tab; label: string }[] = [
  { key: 'people', label: 'People' },
  { key: 'plan', label: 'My plan' },
  { key: 'reviews', label: 'Reviews' },
]

/** One of your trips: the members going too, your own plan, and reviews of the place. */
export function TripMatches() {
  const tripId = Number(useParams().id)
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.some((t) => t.key === params.get('tab')) ? (params.get('tab') as Tab) : 'people'
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined)
  const [people, setPeople] = useState<TripSuggestion[] | null>(null)
  const [companions, setCompanions] = useState<TripCompanion[]>([])
  const requests = useRequests()
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [today] = useState(() => isoDate(new Date()))

  useEffect(() => {
    Promise.all([getTrip(tripId), suggestForTrip(tripId), tripCompanions(tripId).catch(() => [])]).then(
      ([t, p, c]) => {
        setTrip(t)
        setPeople(p)
        setCompanions(c)
        if (p.length) noteFirstMatch()
      },
      (e) => setError(messageOf(e)),
    )
  }, [tripId])

  useEffect(() => {
    if (trip) heading.current?.focus()
  }, [trip])

  if (error || trip === null) {
    return (
      <Layout>
        <h1>{error ? 'Something went wrong' : 'Trip not found'}</h1>
        <p className="lede">{error ?? 'It may have been deleted.'}</p>
        <Link className="btn btn-secondary" to="/trips">
          Back to my trips
        </Link>
      </Layout>
    )
  }
  if (!trip || !people || !requests) return <Loading />

  const flex = flexibilityLabel(trip.flexible_days)
  const picks = picksFor(trip.city_id)
  return (
    <Layout>
      <Link className="back-link" to="/trips">
        ‹ My trips
      </Link>
      <p className="eyebrow">Your trip</p>
      <h1 ref={heading} tabIndex={-1}>
        {cityLabel(trip.city)}
      </h1>
      <div className="trip-summary">
        <p className="lede">
          {tripDates(trip.start_date, trip.end_date)}
          {flex && ` · ${flex}`}
          {trip.visibility === 'hidden' && ' · Hidden from suggestions'}
        </p>
        <Link className="btn btn-secondary btn-small" to={`/trips/${trip.id}/edit`}>
          Edit trip
        </Link>
      </div>

      <div className="hub-tabs trip-tabs" role="tablist" aria-label="Your trip">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`trip-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="trip-panel"
            className={tab === t.key ? 'hub-tab is-current' : 'hub-tab'}
            onClick={() => setParams(t.key === 'people' ? {} : { tab: t.key }, { replace: true })}
          >
            {t.label}
            {t.key === 'people' && people.length + companions.length > 0 && <span className="tab-count"> {people.length + companions.length}</span>}
          </button>
        ))}
      </div>

      <div id="trip-panel" role="tabpanel" aria-labelledby={`trip-tab-${tab}`}>
        {tab === 'plan' && <TripPlanner tripId={trip.id} city={trip.city.name} start={trip.start_date} end={trip.end_date} picks={picks} />}
        {tab === 'reviews' && <CityReviews cityId={trip.city_id} city={trip.city.name} opensOn={trip.start_date > today ? trip.start_date : undefined} />}
        {tab === 'people' && (
          <>
            {people.length + companions.length > 0 && (
              <DateOverlap
                city={trip.city.name}
                mine={{ start: trip.start_date, end: trip.end_date }}
                others={[...companions, ...[...people].sort((a, b) => Number(!!b.overlap_start) - Number(!!a.overlap_start))].map((p) => ({
                  name: p.display_name,
                  start: p.trip_start,
                  end: p.trip_end,
                }))}
              />
            )}

            {companions.length > 0 && (
              <section aria-labelledby="in-touch">
                <h2 id="in-touch" className="section-title">
                  Already in touch
                </h2>
                <ul className="person-list">
                  {companions.map((c) => (
                    <CompanionRow key={c.profile_id} person={c} />
                  ))}
                </ul>
                {companions.some((c) => c.status === 'connected') && (
                  <Link className="btn btn-secondary btn-block" to={`/groups/new?trip=${trip.id}`}>
                    Start a group for this trip
                  </Link>
                )}
              </section>
            )}

            <section aria-labelledby="going-too">
              <h2 id="going-too" className="section-title">
                {people.length
                  ? `${people.length} ${companions.length ? 'more ' : ''}${people.length === 1 ? 'person' : 'people'} going too`
                  : companions.length
                    ? 'More people going too'
                    : 'People going too'}
              </h2>
              {people.length > 0 && <RequestsHint requests={requests} />}
              {people.length === 0 ? (
                <div className="card empty">
                  {companions.length ? (
                    <p>No one else yet. As more members add trips to {trip.city.name} around your dates, they’ll appear here.</p>
                  ) : (
                    <>
                      <p>No one yet. As members add trips to {trip.city.name} around your dates, they’ll appear here, best match first.</p>
                      <p className="hint">Making your dates more flexible can help. Tap Edit trip to change them.</p>
                    </>
                  )}
                </div>
              ) : (
                <ul className="match-list">
                  {people.map((person) => (
                    <SuggestionCard key={person.profile_id} person={person} reasons={reasons(person, trip.city.name)} tripId={trip.id} requests={requests} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  )
}

const COMPANION_STATUS: Record<TripCompanion['status'], string> = {
  connected: 'Connected',
  group: 'In a group with you',
  you_asked: 'Waiting for their reply',
  they_asked: 'Asked to connect with you',
}

/** Someone on this trip you've already asked, been asked by, or connected with. */
function CompanionRow({ person }: { person: TripCompanion }) {
  const home = homeLabel(person)
  return (
    <li className="card person-card companion-row">
      <Avatar name={person.display_name} path={person.photo_path} />
      <div className="companion-who">
        <h3>{person.display_name}</h3>
        <p className="profile-meta">
          {person.birth_year ? `Age ${ageLabel(person.birth_year)}` : null}
          {home && ` · ${home}`}
        </p>
        <p className="profile-meta">
          {COMPANION_STATUS[person.status]} · There {tripDates(person.trip_start, person.trip_end)}
        </p>
      </div>
      {person.status === 'they_asked' ? (
        <Link className="btn btn-primary btn-small" to="/connections/requests">
          Answer
        </Link>
      ) : person.status === 'connected' || person.status === 'group' ? (
        <Link className="btn btn-secondary btn-small" to={`/connections/people/${person.profile_id}`}>
          Profile
        </Link>
      ) : null}
    </li>
  )
}
