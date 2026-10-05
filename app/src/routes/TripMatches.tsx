import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Field } from '../components/Field'
import { Layout, Loading } from '../components/Layout'
import { SafetyBox } from '../components/SafetyBox'
import { requestsLeft, sendRequest, WEEKLY_REQUESTS } from '../lib/connections'
import { cityLabel } from '../lib/cities'
import { tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { homeLabel, reasons, suggestForTrip, type TripSuggestion } from '../lib/matching'
import { ageLabel } from '../lib/options'
import { flexibilityLabel, getTrip, type Trip } from '../lib/trips'
import { MAX_NOTE } from '../lib/validation'

/** One trip and the members going to the same place at the same time. */
export function TripMatches() {
  const tripId = Number(useParams().id)
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined)
  const [people, setPeople] = useState<TripSuggestion[] | null>(null)
  const [left, setLeft] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    Promise.all([getTrip(tripId), suggestForTrip(tripId), requestsLeft()]).then(
      ([t, p, l]) => {
        setTrip(t)
        setPeople(p)
        setLeft(l)
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
        {people.length > 0 && (
          <p className="hint section-hint">
            Best fit first. You have {left} of {WEEKLY_REQUESTS} requests left this week{left === 0 ? '; you get 5 more on Monday' : ''}.
          </p>
        )}
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
              <MatchCard key={person.profile_id} person={person} myCity={trip.city.name} tripId={trip.id} left={left} onSent={() => setLeft((n) => Math.max(0, n - 1))} />
            ))}
          </ul>
        )}
      </section>
    </Layout>
  )
}

function MatchCard({ person, myCity, tripId, left, onSent }: { person: TripSuggestion; myCity: string; tripId: number; left: number; onSent: () => void }) {
  const [gone, setGone] = useState<string | null>(null)
  const home = homeLabel(person)
  if (gone) {
    return (
      <li className="card">
        <p className="notice notice-success" role="status">
          {gone}
        </p>
      </li>
    )
  }
  return (
    <li className="card match-card">
      <div className="match-head">
        <Avatar name={person.display_name} path={person.photo_path} />
        <div className="match-who">
          <div className="match-name">
            <h3>{person.display_name}</h3>
            <span className="match-score" title="How well your interests, dates and travel style line up">
              {person.score}% in common
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
      <ConnectBox person={person} tripId={tripId} left={left} onSent={onSent} />
      <SafetyBox profileId={person.profile_id} name={person.display_name} onBlocked={setGone} />
    </li>
  )
}

function ConnectBox({ person, tripId, left, onSent }: { person: TripSuggestion; tripId: number; left: number; onSent: () => void }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const noteBox = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) noteBox.current?.focus()
  }, [open])

  if (sent) {
    return (
      <p className="notice notice-success" role="status">
        Request sent. We’ll let you know when {person.display_name} replies.
      </p>
    )
  }
  if (!open) {
    return (
      <button type="button" className="btn btn-primary btn-block" disabled={left <= 0} onClick={() => setOpen(true)}>
        {left > 0 ? `Ask to connect with ${person.display_name}` : 'No requests left this week'}
      </button>
    )
  }

  async function send() {
    setBusy(true)
    setError(null)
    try {
      await sendRequest(person.profile_id, note, tripId)
      setSent(true)
      onSent()
    } catch (e) {
      setError(messageOf(e))
      setBusy(false)
    }
  }

  return (
    <div className="connect-box">
      <Field
        name="note"
        label={`Add a note for ${person.display_name} (optional)`}
        hint={`Say hello and what you’d like to do together. ${MAX_NOTE - note.length} characters left.`}
      >
        {({ id, describedBy }) => (
          <textarea
            ref={noteBox}
            id={id}
            className="textarea textarea-short"
            maxLength={MAX_NOTE}
            aria-describedby={describedBy}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </Field>
      <p className="hint">
        This uses 1 of your {left} request{left === 1 ? '' : 's'} left this week. Nothing else is shared until they say yes.
      </p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="action-row">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>
          {busy ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </div>
  )
}
