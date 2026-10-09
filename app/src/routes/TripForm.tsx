import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { CityPicker } from '../components/CityPicker'
import { DateRangePicker } from '../components/DateRangePicker'
import { Field } from '../components/Field'
import { ActionBar, SaveError } from '../components/Form'
import { useConfirm } from '../lib/useConfirm'
import { Layout, Loading } from '../components/Layout'
import { Segmented } from '../components/Segmented'
import type { City } from '../lib/cities'
import { addDays, isoDate } from '../lib/dates'
import { rules } from '../lib/rules'
import { messageOf } from '../lib/errors'
import type { Option } from '../lib/options'
import { deleteTrip, getTrip, saveTrip, type Trip } from '../lib/trips'
import { useChecks } from '../lib/useChecks'
import { MAX_NOTE, MAX_TRIP_DAYS, checkNote, checkTripDates } from '../lib/validation'

type Flex = '0' | '1' | '3' | '7'
const FLEXIBILITY: readonly Option<Flex>[] = [
  { value: '0', label: 'Exact dates' },
  { value: '1', label: '1 day either way' },
  { value: '3', label: '3 days either way' },
  { value: '7', label: '1 week either way' },
]
const toFlex = (days: number): Flex => (FLEXIBILITY.find((f) => Number(f.value) >= days)?.value ?? '7')

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
  const [flex, setFlex] = useState<Flex>(toFlex(trip?.flexible_days ?? 0))
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
          flexible_days: Number(flex),
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
      <form onSubmit={submit} noValidate>
        <p className="eyebrow">{trip ? 'Edit trip' : 'New trip'}</p>
        <h1 ref={heading} tabIndex={-1}>
          {trip ? `Your trip to ${trip.city.name}` : 'Where are you going?'}
        </h1>
        <p className="lede">We’ll suggest members heading to the same place at the same time.</p>

        <div className="card form-card">
          <div data-field="city">
            <CityPicker
              label="Destination"
              hint="Start typing a town or city, then pick it from the list."
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
          <Segmented
            name="flex"
            legend="How flexible are your dates?"
            hint="We’ll also suggest people whose dates are close to yours."
            options={FLEXIBILITY}
            selected={[flex]}
            onChange={([v]) => setFlex(v)}
          />
          <details className="more-options" open={!!trip?.note || (trip ? trip.visibility === 'hidden' : false)}>
            <summary>Add a note or keep it private</summary>
            <div className="more-options-body">
              <Field
                name="note"
                label="Anything to add? (optional)"
                hint={`For example, “Hoping to see the tiles museum and eat lots of pastéis”. ${MAX_NOTE - note.length} characters left.`}
                error={shown('note')}
              >
                {({ id, describedBy, invalid }) => (
                  <textarea
                    id={id}
                    className="textarea textarea-short"
                    maxLength={MAX_NOTE}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={() => touch('note')}
                  />
                )}
              </Field>
              <label className="switch-row">
                <input type="checkbox" role="switch" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
                <span>
                  <strong>Let other members see this trip</strong>
                  <span className="hint">Turn this off to keep it just for you. You can turn it back on any time.</span>
                </span>
              </label>
            </div>
          </details>
          {trip && (
            <button type="button" className="btn-link btn-danger-link" onClick={remove} disabled={busy}>
              Delete this trip
            </button>
          )}
        </div>
        <SaveError error={error} />
        <ActionBar busy={busy} onBack={() => navigate(trip ? `/trips/${trip.id}` : '/trips')} label={trip ? 'Save changes' : 'Add trip'} />
      </form>
    </Layout>
  )
}
