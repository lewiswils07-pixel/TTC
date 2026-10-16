import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { CityPhoto } from '../components/CityPhoto'
import { CityPicker } from '../components/CityPicker'
import { AgeRange } from '../components/AgeRange'
import { DateRangePicker } from '../components/DateRangePicker'
import { FieldError, TextField } from '../components/Field'
import { ActionBar, SaveError } from '../components/Form'
import { Layout, Loading } from '../components/Layout'
import { Segmented } from '../components/Segmented'
import type { City } from '../lib/cities'
import { myConnections, type Connection } from '../lib/connections'
import { addDays, isoDate, shortDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { brand } from '../lib/brand'
import { rules } from '../lib/rules'
import { checkGroupName, createGroup, groupsICanStart, MAX_GROUP, MAX_GROUP_NAME } from '../lib/groups'
import { MAX_PREF_AGE, MIN_AGE } from '../lib/options'
import { useSession } from '../lib/session-context'
import { listMyTrips, type Trip } from '../lib/trips'
import { useMyProfile } from '../lib/useMyProfile'
import { useChecks } from '../lib/useChecks'
import { MAX_TRIP_DAYS, checkTripDates } from '../lib/validation'

/** Start a group: a name, whether it's for a trip (where and when), and who to invite. */
export function GroupForm() {
  const [people, setPeople] = useState<Connection[] | null>(null)
  const [canStart, setCanStart] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([myConnections(), groupsICanStart()]).then(
      ([c, n]) => {
        setPeople(c.filter((x) => x.status === 'accepted'))
        setCanStart(n)
      },
      (e) => setLoadError(messageOf(e)),
    )
  }, [])

  if (loadError) {
    return (
      <Layout>
        <p className="notice notice-error" role="alert">
          {loadError}
        </p>
      </Layout>
    )
  }
  if (!people || canStart === null) return <Loading />
  if (canStart === 0) {
    return (
      <Layout>
        <h1>Start a group</h1>
        <p className="lede">
          You’ve reached your limit of groups for now. You can start another once you leave one or its trip is over, or have up to {rules.groups.maxOwnedPlus} with {brand.plusName}.
        </p>
        <Link className="btn btn-secondary" to="/groups">
          Back to groups
        </Link>
      </Layout>
    )
  }
  return <GroupEditor people={people} />
}

function GroupEditor({ people }: { people: Connection[] }) {
  const navigate = useNavigate()
  const [today] = useState(() => isoDate(new Date()))
  const heading = useRef<HTMLHeadingElement>(null)
  // From "Popular right now" on Groups: a trip group going there.
  const popular = (useLocation().state as { city?: City } | null)?.city ?? null
  const [name, setName] = useState(popular ? `${popular.name} trip`.slice(0, MAX_GROUP_NAME) : '')
  const [city, setCity] = useState<City | null>(popular)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [invite, setInvite] = useState<string[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const fromTrip = Number(useSearchParams()[0].get('trip')) || null
  const [kind, setKind] = useState<'chat' | 'trip'>(fromTrip || popular ? 'trip' : 'chat')
  const forTrip = kind === 'trip'
  // Who can join (Lewis, 13 Oct): open groups, women-only groups and an age range.
  // With no connections yet, a trip group is open so it isn't a dead end (Josh, 13 Oct).
  const [open, setOpen] = useState(people.length === 0)
  const [womenOnly, setWomenOnly] = useState(false)
  const [ages, setAges] = useState<[number, number]>([MIN_AGE, MAX_PREF_AGE])
  const { session } = useSession()
  const isWoman = useMyProfile(session!.user.id).data?.profile.gender === 'woman'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dates = checkTripDates(start, end, today)
  const errors = {
    name: checkGroupName(name),
    city: !forTrip || city ? null : 'Please choose where the group is going.',
    start: forTrip ? dates.start : null,
    end: forTrip ? dates.end : null,
    invite: invite.length || (forTrip && open) ? null : 'Please choose at least one person to invite.',
  }
  const { shown, touch, validateAll } = useChecks(errors)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  // Start from one of your trips instead of typing it all again (testers).
  useEffect(() => {
    listMyTrips().then(
      (list) => {
        setTrips(list ?? [])
        const t = list?.find((x) => x.id === fromTrip)
        if (t) fillFromTrip(t)
      },
      () => undefined,
    )
  }, [fromTrip])

  function fillFromTrip(t: Trip) {
    setCity(t.city)
    setStart(t.start_date)
    setEnd(t.end_date)
    setName((n) => n || `${t.city.name} trip`.slice(0, MAX_GROUP_NAME))
  }

  function toggle(id: string) {
    setInvite((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length < MAX_GROUP - 1 ? [...list, id] : list))
    touch('invite')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!validateAll()) return
    setBusy(true)
    setError(null)
    try {
      const settings = {
        open: forTrip && open,
        women_only: isWoman && womenOnly,
        age_min: ages[0] > MIN_AGE ? ages[0] : null,
        age_max: ages[1] < MAX_PREF_AGE ? ages[1] : null,
      }
      const id = await createGroup({ name, trip: forTrip ? { cityId: city!.id, start, end } : null, invite, settings })
      navigate(`/groups/${id}`, {
        replace: true,
        state: { message: invite.length ? 'Your group is ready. We’ve sent your invites.' : 'Your group is ready. Members going there can now find it and join.' },
      })
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }

  return (
    <Layout>
      <form onSubmit={submit} noValidate>
        <div className="form-top">
          <Link className="form-top-cancel" to="/groups">
            Cancel
          </Link>
          <p className="form-top-title">New group</p>
          <span className="form-top-space" />
        </div>
        <h1 ref={heading} tabIndex={-1}>
          Start a group
        </h1>
        <p className="lede">Plan a trip or just chat, with up to {rules.groups.maxPeople} people.</p>

        <div className="group-form">
          <Segmented
            name="kind"
            legend="What’s it for?"
            options={[
              { value: 'chat', label: 'Chatting' },
              { value: 'trip', label: 'A trip' },
            ]}
            selected={[kind]}
            onChange={([k]) => setKind(k)}
            hint={forTrip ? 'Plan together on a shared board and see everyone’s dates.' : 'Just a group chat. You can make it a trip later.'}
          />
          {forTrip && trips.length > 0 && (
            <fieldset className="field">
              <legend>Start from one of your trips</legend>
              <div className="from-trips">
                {trips.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    className={city?.id === t.city_id && start === t.start_date ? 'from-trip is-on' : 'from-trip'}
                    aria-pressed={city?.id === t.city_id && start === t.start_date}
                    onClick={() => fillFromTrip(t)}
                  >
                    <CityPhoto city={t.city.name} width={80} code className="from-trip-photo" />
                    {t.city.name} · {shortDates(t.start_date, t.end_date)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <TextField
            name="name"
            label="Group name"
            hint={`For example, “Lisbon in May” or “Walking friends”. ${MAX_GROUP_NAME - name.length} characters left.`}
            maxLength={MAX_GROUP_NAME}
            value={name}
            error={shown('name')}
            onChange={(e) => {
              setName(e.target.value)
              touch('name')
            }}
            onBlur={() => touch('name')}
          />
          {forTrip && (
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
                onChange={(s, e) => {
                  setStart(s)
                  setEnd(e)
                  touch('start')
                  if (e) touch('end')
                }}
              />
            </>
          )}
          {forTrip && (
            <Segmented
              name="who-joins"
              legend="Who can join?"
              options={[
                { value: 'invite', label: 'People I invite' },
                { value: 'open', label: 'Anyone who fits' },
              ]}
              selected={[open ? 'open' : 'invite']}
              onChange={([v]) => setOpen(v === 'open')}
              hint={open ? `Members going to ${city?.name ?? 'the same place'} can find your group and join. You can still invite people.` : 'Only people you invite can join.'}
            />
          )}
          <div className="card group-rules">
            {isWoman && (
              <label className="switch-row">
                <input type="checkbox" role="switch" checked={womenOnly} onChange={(e) => setWomenOnly(e.target.checked)} />
                <span>
                  <strong>Women only</strong>
                  <span className="hint">Only women can be invited or join.</span>
                </span>
              </label>
            )}
            <AgeRange legend="Ages who can join (optional)" min={MIN_AGE} max={MAX_PREF_AGE} value={ages} onChange={setAges} />
          </div>
          <fieldset className="field" data-field="invite" aria-describedby={shown('invite') ? 'invite-error' : 'invite-hint'}>
            <legend>{forTrip && open ? 'Who to invite (optional)' : 'Who to invite'}</legend>
            <p className="hint" id="invite-hint">
              {people.length ? `${invite.length} chosen, up to ${rules.groups.maxPeople - 1}.` : 'Only people you’re connected with can be invited.'}
            </p>
            {people.length === 0 ? (
              <Link to="/connections">Find people to travel with</Link>
            ) : (
              <ul className="invite-list">
                {people.map((p) => {
                  const checked = invite.includes(p.profile_id)
                  const full = !checked && invite.length >= MAX_GROUP - 1
                  return (
                    <li key={p.profile_id}>
                      <label className={`invite-option${checked ? ' is-checked' : ''}${full ? ' is-disabled' : ''}`}>
                        <input type="checkbox" checked={checked} disabled={full} onChange={() => toggle(p.profile_id)} />
                        <Avatar name={p.display_name} path={p.photo_path} size="sm" />
                        <span>{p.display_name}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            <FieldError id="invite-error" error={shown('invite')} />
          </fieldset>
        </div>
        <SaveError error={error} />
        <ActionBar busy={busy} label="Start group" />
      </form>
    </Layout>
  )
}
