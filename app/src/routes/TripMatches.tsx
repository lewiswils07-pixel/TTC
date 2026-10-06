import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { RequestsHint, SuggestionCard, useRequests } from '../components/Suggestions'
import { cityLabel } from '../lib/cities'
import { tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { noteFirstMatch } from '../lib/kpis'
import { reasons, suggestForTrip, type TripSuggestion } from '../lib/matching'
import { flexibilityLabel, getTrip, type Trip } from '../lib/trips'

/** One trip and the members going to the same place at the same time. */
export function TripMatches() {
  const tripId = Number(useParams().id)
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined)
  const [people, setPeople] = useState<TripSuggestion[] | null>(null)
  const requests = useRequests()
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    Promise.all([getTrip(tripId), suggestForTrip(tripId)]).then(
      ([t, p]) => {
        setTrip(t)
        setPeople(p)
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

      <section aria-labelledby="going-too">
        <h2 id="going-too" className="section-title">
          {people.length ? `${people.length} ${people.length === 1 ? 'person' : 'people'} going too` : 'People going too'}
        </h2>
        {people.length > 0 && <RequestsHint requests={requests} />}
        {people.length === 0 ? (
          <div className="card empty">
            <p>
              No one matches yet. As members add trips to {trip.city.name} around your dates, they’ll appear here, best match
              first.
            </p>
            <p className="hint">Widening your dates with “How flexible are your dates?” can help.</p>
          </div>
        ) : (
          <ul className="match-list">
            {people.map((person) => (
              <SuggestionCard key={person.profile_id} person={person} reasons={reasons(person, trip.city.name)} tripId={trip.id} requests={requests} />
            ))}
          </ul>
        )}
      </section>
    </Layout>
  )
}
