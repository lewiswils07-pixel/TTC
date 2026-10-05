import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { cityLabel } from '../lib/cities'
import { tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { homeLabel, reasons, suggestForTrip, type TripSuggestion } from '../lib/matching'
import { ageLabel } from '../lib/options'
import { photoUrl } from '../lib/photo'
import { flexibilityLabel, getTrip, type Trip } from '../lib/trips'

/** One trip and the members going to the same place at the same time. */
export function TripMatches() {
  const tripId = Number(useParams().id)
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined)
  const [people, setPeople] = useState<TripSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    Promise.all([getTrip(tripId), suggestForTrip(tripId)]).then(
      ([t, p]) => {
        setTrip(t)
        setPeople(p)
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
        <Link className="btn btn-secondary" to="/dashboard">
          Back to my profile
        </Link>
      </Layout>
    )
  }
  if (!trip || !people) return <Loading />

  const flex = flexibilityLabel(trip.flexible_days)
  return (
    <Layout>
      <Link className="back-link" to="/dashboard">
        ‹ My profile
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
        {people.length > 0 && <p className="hint section-hint">Best match first. Sending connection requests opens soon.</p>}
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
              <MatchCard key={person.profile_id} person={person} myCity={trip.city.name} />
            ))}
          </ul>
        )}
      </section>
    </Layout>
  )
}

function MatchCard({ person, myCity }: { person: TripSuggestion; myCity: string }) {
  const [photo, setPhoto] = useState<string | null>(null)
  useEffect(() => {
    if (person.photo_path) photoUrl(person.photo_path).then(setPhoto, () => undefined)
  }, [person.photo_path])

  const home = homeLabel(person)
  return (
    <li className="card match-card">
      <div className="match-head">
        {photo ? (
          <img className="avatar avatar-md" src={photo} alt="" />
        ) : (
          <div className="avatar avatar-md avatar-empty" aria-hidden="true">
            {person.display_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="match-who">
          <div className="match-name">
            <h3>{person.display_name}</h3>
            <span className="match-score" title="How well your interests, dates and travel style line up">
              {person.score}% match
            </span>
          </div>
          <p className="profile-meta">
            {person.birth_year ? `Age ${ageLabel(person.birth_year)}` : null}
            {home && ` · ${home}`}
          </p>
        </div>
      </div>
      <ul className="match-reasons">
        {reasons(person, myCity).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </li>
  )
}
