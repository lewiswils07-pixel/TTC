import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { CityPicker } from '../components/CityPicker'
import { DateRangePicker } from '../components/DateRangePicker'
import { FieldError } from '../components/Field'
import { Eye, EyeOff } from 'lucide-react'
import { SaveError } from '../components/Form'
import { useConfirm } from '../lib/useConfirm'
import { Layout, Loading } from '../components/Layout'
import type { City } from '../lib/cities'
import { addDays, isoDate } from '../lib/dates'
import { rules } from '../lib/rules'
import { messageOf } from '../lib/errors'
import { deleteTrip, getTrip, saveTrip, type Trip } from '../lib/trips'
import { useChecks } from '../lib/useChecks'
import { MAX_NOTE, MAX_TRIP_DAYS, checkNote, checkTripDates } from '../lib/validation'

/** Add a trip (/trips/new) or change one (/trips/:id/edit). */
export function TripForm() {
  const { id } = useParams()
  const tripId = id ? Number(id) : undefined
  const [trip, setTrip] = useState<Trip | null | undefined>(tripId ? undefined : null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!tripId) return
    getTrip(tripId).then(setTrip, (e) => setLoadError(messageOf(e)))
  }, [tripId])

  if (loadError) {
    return (
      <Layout>
        <p className="notice notice-error" role="alert">
          {loadError}
        </p>
        <Link className="btn btn-secondary" to="/trips">
          Back to my trips
        </Link>
      </Layout>
    )
  }
  if (trip === undefined) return <Loading />
  if (tripId && !trip) {
    return (
      <Layout>
        <h1>Trip not found</h1>
        <p className="lede">It may have been deleted.</p>
        <Link className="btn btn-secondary" to="/trips">
          Back to my trips
        </Link>
      </Layout>
    )
  }
  return <TripEditor trip={trip} />
}

function TripEditor({ trip }: { trip: Trip | null }) {
  const { ask, dialog: confirmDialog } = useConfirm()
  const navigate = useNavigate()
  const [today] = useState(() => isoDate(new Date()))
  const heading = useRef<HTMLHeadingElement>(null)
  const picked = (useLocation().state as { city?: City } | null)?.city
  const [city, setCity] = useState<City | null>(trip?.city ?? picked ?? null)
  const [start, setStart] = useState(trip?.start_date ?? '')
  const [end, setEnd] = useState(trip?.end_date ?? '')
  const [note, setNote] = useState(trip?.note ?? '')
  const [visible, setVisible] = useState(trip ? trip.visibility === 'members' : true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dates = checkTripDates(start, end, today)
  const errors = {
    city: city ? null : 'Please choose where you’re going.',
    start: dates.start,
    end: dates.end,
    note: checkNote(note),
  }
  const { shown, touch, validateAll } = useChecks(errors)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!validateAll()) return
    setBusy(true)
    setError(null)
    try {
      const savedId = await saveTrip(
        {
          city_id: city!.id,
          start_date: start,
          end_date: end,
          // "Give or take" dates are gone (Lewis, 11 Oct); close dates still count in matching.
          flexible_days: trip?.flexible_days ?? 0,
          note: note.trim() || null,
          visibility: visible ? 'members' : 'hidden',
        },
        trip?.id,
      )
      navigate(`/trips/${savedId}`, { replace: true })
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!trip || !(await ask({ title: `Delete your trip to ${trip.city.name}?`, message: 'People going too will no longer see it.', confirmLabel: 'Delete trip', danger: true }))) return
    setBusy(true)
    setError(null)
    try {
      await deleteTrip(trip.id)
      navigate('/trips', { replace: true })
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }

  return (
    <Layout>
      {confirmDialog}
      <form onSubmit={submit} noValidate className="trip-form">
        <div className="form-top">
          <Link className="form-top-cancel" to={trip ? `/trips/${trip.id}` : '/trips'}>
            Cancel
          </Link>
          <p className="form-top-title">{trip ? 'Edit trip' : 'Add a trip'}</p>
          <span className="form-top-space" />
        </div>
        <h1 ref={heading} tabIndex={-1}>
          {trip ? `Your trip to ${trip.city.name}` : 'Where are you going?'}
        </h1>

        <div className="card form-card">
          <div data-field="city">
            <CityPicker
              label="Destination"
              value={city}
              onChange={(c) => {
                setCity(c)
                if (c) touch('city')
              }}
              onBlur={() => touch('city')}
              error={shown('city')}
            />
          </div>
          <DateRangePicker
            start={start}
            end={end}
            min={today}
            max={addDays(today, rules.trips.maxDaysAhead)}
            maxDays={MAX_TRIP_DAYS}
            error={shown('start') ?? shown('end')}
            onChange={(s, e) => {
              setStart(s)
              setEnd(e)
              touch('start')
              if (e) touch('end')
            }}
          />
          <div className="field" data-field="note">
            <label htmlFor="trip-note">
              A note for other members <span className="label-quiet">(optional)</span>
            </label>
            <textarea
              id="trip-note"
              className="textarea textarea-short"
              maxLength={MAX_NOTE}
              placeholder="For example, first time in Portugal. Keen on a fado night and a day out to Sintra."
              aria-describedby="trip-note-count"
              aria-invalid={shown('note') ? true : undefined}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => touch('note')}
            />
            <p className="char-count" id="trip-note-count">
              {note.length} / {MAX_NOTE}
            </p>
            <FieldError error={shown('note')} />
          </div>
          <label className="switch-card">
            <span className="switch-card-icon" aria-hidden="true">
              {visible ? <Eye size={22} strokeWidth={1.8} /> : <EyeOff size={22} strokeWidth={1.8} />}
            </span>
            <span className="switch-card-text">
              <strong>Let other members see this trip</strong>
              <span>{visible ? 'So people going at the same time can say hello.' : 'Only you can see it. Turn it back on any time.'}</span>
            </span>
            <input type="checkbox" role="switch" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          </label>
        </div>
        <SaveError error={error} />
        <div className="action-bar action-bar-stack">
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Saving…' : 'Save trip'}
          </button>
          {trip && (
            <button type="button" className="btn btn-quiet btn-block btn-danger-link" onClick={remove} disabled={busy}>
              Delete this trip
            </button>
          )}
        </div>
      </form>
    </Layout>
  )
}
