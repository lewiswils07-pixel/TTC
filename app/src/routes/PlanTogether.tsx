import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CityPicker } from '../components/CityPicker'
import { DateRangePicker } from '../components/DateRangePicker'
import { ActionBar, SaveError } from '../components/Form'
import { Layout } from '../components/Layout'
import { SkeletonRows } from '../components/Skeleton'
import { myConversations } from '../lib/chat'
import { cityLabel, type City } from '../lib/cities'
import { addDays, isoDate, shortDates, tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { rules } from '../lib/rules'
import { planTripTogether } from '../lib/together'
import { listMyTrips, type Trip } from '../lib/trips'
import { useChecks } from '../lib/useChecks'
import { MAX_TRIP_DAYS, checkTripDates } from '../lib/validation'
import { AddIcon } from '../components/Icons'
import { Avatar } from '../components/Avatar'
import { CityPhoto } from '../components/CityPhoto'
import { BriefcaseBusiness } from 'lucide-react'
import { ageLabel } from '../lib/options'

/** Invite a connection to plan a trip together: one of your trips, or somewhere new. */
export function PlanTogether() {
  const profileId = useParams().id!
  const navigate = useNavigate()
  const heading = useRef<HTMLHeadingElement>(null)
  const [today] = useState(() => isoDate(new Date()))
  const [who, setWho] = useState<{ name: string; chat: number; photo: string | null; age: string | null } | null | undefined>(undefined)
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
        setWho(chat ? { name: chat.display_name, chat: chat.id, photo: chat.photo_path, age: chat.birth_year ? ageLabel(chat.birth_year) : null } : null)
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
      <form onSubmit={submit} noValidate>
        <div className="form-top">
          <Link className="form-top-cancel" to={who ? `/messages/${who.chat}` : '/messages'}>
            Cancel
          </Link>
          <p className="form-top-title">New plan</p>
          <span className="form-top-space" />
        </div>
        <h1 ref={heading} tabIndex={-1}>
          Plan a trip together
        </h1>
        {who && (
          <div className="together-with">
            <Avatar name={who.name} path={who.photo} size="sm" square />
            <span>
              With <strong>{who.name}</strong>
              {who.age ? `, ${who.age}` : ''}
            </span>
          </div>
        )}
        {error && !trips && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        {!trips || !who ? (
          !error && <SkeletonRows rows={2} label="Loading your trips…" />
        ) : (
          <>
            <fieldset className="field">
              <legend>Choose a trip</legend>
              <ul className="together-choices">
                {trips.map((t) => (
                  <li key={t.id}>
                    <label className={`together-choice${choice === t.id ? ' is-checked' : ''}`}>
                      <CityPhoto city={t.city.name} country={t.city.country_code} region={t.city.region} width={120} code className="together-choice-photo" />
                      <span className="together-choice-text">
                        <strong>{t.city.name}</strong>
                        <span className="hint">Your trip · {shortDates(t.start_date, t.end_date)}</span>
                      </span>
                      <input type="radio" name="trip" checked={choice === t.id} onChange={() => setChoice(t.id)} aria-label={`${cityLabel(t.city)}, ${tripDates(t.start_date, t.end_date)}`} />
                    </label>
                  </li>
                ))}
                <li>
                  <label className={`together-choice${somewhereNew ? ' is-checked' : ''}`}>
                    <span className="together-choice-new" aria-hidden="true">
                      <AddIcon />
                    </span>
                    <span className="together-choice-text">
                      <strong>Somewhere new</strong>
                      <span className="hint">Pick a place together</span>
                    </span>
                    <input type="radio" name="trip" checked={somewhereNew} onChange={() => setChoice('new')} />
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
            <p className="tip-box together-note">
              <BriefcaseBusiness size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>
                {who.name} gets an invite in your chat. If they say yes, it goes in both your trips with a shared plan board{somewhereNew ? ', and it’s added to your trips too' : ''}.
              </span>
            </p>
          </>
        )}
        <SaveError error={trips ? error : null} />
        <ActionBar busy={busy} label="Send invite" />
      </form>
    </Layout>
  )
}
