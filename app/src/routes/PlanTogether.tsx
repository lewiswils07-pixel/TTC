import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CityPicker } from '../components/CityPicker'
import { DateRangePicker } from '../components/DateRangePicker'
import { ActionBar, SaveError } from '../components/Form'
import { Layout } from '../components/Layout'
import { SkeletonRows } from '../components/Skeleton'
import { myConversations } from '../lib/chat'
import { cityLabel, type City } from '../lib/cities'
import { addDays, isoDate, tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { rules } from '../lib/rules'
import { planTripTogether } from '../lib/together'
import { listMyTrips, type Trip } from '../lib/trips'
import { useChecks } from '../lib/useChecks'
import { MAX_TRIP_DAYS, checkTripDates } from '../lib/validation'

/** Invite a connection to plan a trip together: one of your trips, or somewhere new. */
export function PlanTogether() {
  const profileId = useParams().id!
  const navigate = useNavigate()
  const heading = useRef<HTMLHeadingElement>(null)
  const [today] = useState(() => isoDate(new Date()))
  const [who, setWho] = useState<{ name: string; chat: number } | null | undefined>(undefined)
  const [trips, setTrips] = useState<Trip[] | null>(null)
  const [choice, setChoice] = useState<number | 'new' | null>(null)
  const [city, setCity] = useState<City | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([myConversations(), listMyTrips()]).then(
      ([all, mine]) => {
        const chat = all?.find((c) => c.kind === 'direct' && c.profile_id === profileId && c.can_message)
        setWho(chat ? { name: chat.display_name, chat: chat.id } : null)
        setTrips(mine ?? [])
        setChoice(mine?.length ? mine[0].id : 'new')
        heading.current?.focus()
      },
      (e) => setError(messageOf(e)),
    )
  }, [profileId])

  const dates = checkTripDates(start, end, today)
  const somewhereNew = choice === 'new'
  const { shown, touch, validateAll } = useChecks({
    city: somewhereNew && !city ? 'Please choose where you’d like to go.' : null,
    start: somewhereNew ? dates.start : null,
    end: somewhereNew ? dates.end : null,
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!who || choice === null || !validateAll()) return
    setBusy(true)
    setError(null)
    try {
      await planTripTogether(profileId, somewhereNew ? { cityId: city!.id, start, end } : { tripId: choice })
      navigate(`/messages/${who.chat}`, { replace: true })
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }

  if (who === null) {
    return (
      <Layout tab="chat">
        <h1>Plan a trip together</h1>
        <p className="lede">You can plan a trip with people you’re connected with. Once they accept your request, you’ll find this in your chat with them.</p>
        <Link className="btn btn-secondary" to="/messages">
          Back to chats
        </Link>
      </Layout>
    )
  }

  return (
    <Layout tab="chat">
      {who && (
        <Link className="back-link" to={`/messages/${who.chat}`}>
          ‹ {who.name}
        </Link>
      )}
      <form onSubmit={submit} noValidate>
        <h1 ref={heading} tabIndex={-1}>
          {who ? `Plan a trip with ${who.name}` : 'Plan a trip together'}
        </h1>
        <p className="lede">
          {who ? `${who.name} gets an invite in your chat.` : 'They get an invite in your chat.'} If they say yes, the trip goes in both your Trips, with
          a shared plan board for ideas. You can invite more people later.
        </p>
        {error && !trips && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        {!trips || !who ? (
          !error && <SkeletonRows rows={2} label="Loading your trips…" />
        ) : (
          <div className="card form-card">
            <fieldset className="field">
              <legend>Where to?</legend>
              <ul className="together-choices">
                {trips.map((t) => (
                  <li key={t.id}>
                    <label className={`together-choice${choice === t.id ? ' is-checked' : ''}`}>
                      <input type="radio" name="trip" checked={choice === t.id} onChange={() => setChoice(t.id)} />
                      <span>
                        <strong>{cityLabel(t.city)}</strong>
                        <span className="hint">{tripDates(t.start_date, t.end_date)}</span>
                      </span>
                    </label>
                  </li>
                ))}
                <li>
                  <label className={`together-choice${somewhereNew ? ' is-checked' : ''}`}>
                    <input type="radio" name="trip" checked={somewhereNew} onChange={() => setChoice('new')} />
                    <span>
                      <strong>Somewhere new</strong>
                      <span className="hint">It’s added to your trips too.</span>
                    </span>
                  </label>
                </li>
              </ul>
            </fieldset>
            {somewhereNew && (
              <>
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
                  onChange={(s, en) => {
                    setStart(s)
                    setEnd(en)
                    touch('start')
                    if (en) touch('end')
                  }}
                />
              </>
            )}
          </div>
        )}
        <SaveError error={trips ? error : null} />
        <ActionBar busy={busy} onBack={() => navigate(-1)} label="Send invite" />
      </form>
    </Layout>
  )
}
