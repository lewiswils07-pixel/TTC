import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Avatar } from '../components/Avatar'
import { CityPicker } from '../components/CityPicker'
import { FieldError, TextField } from '../components/Field'
import { ActionBar, SaveError } from '../components/Form'
import { Layout, Loading } from '../components/Layout'
import type { City } from '../lib/cities'
import { myConnections, type Connection } from '../lib/connections'
import { isoDate } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { checkGroupName, createGroup, groupsICanStart, MAX_GROUP, MAX_GROUP_NAME } from '../lib/groups'
import { useChecks } from '../lib/useChecks'
import { checkTripDates } from '../lib/validation'

/** Start a group: a name, where and when, and who to invite. */
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
        <p className="lede">You’ve reached your limit of groups for now. You can start another when your current group’s trip is over, or have up to 3 with Sodalis+.</p>
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
  const [name, setName] = useState('')
  const [city, setCity] = useState<City | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [invite, setInvite] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dates = checkTripDates(start, end, today)
  const errors = {
    name: checkGroupName(name),
    city: city ? null : 'Please choose where the group is going.',
    start: dates.start,
    end: dates.end,
    invite: invite.length ? null : 'Please choose at least one person to invite.',
  }
  const { shown, touch, validateAll } = useChecks(errors)

  useEffect(() => {
    heading.current?.focus()
  }, [])

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
      const id = await createGroup({ name, cityId: city!.id, start, end, invite })
      navigate(`/groups/${id}`, { replace: true, state: { message: 'Your group is ready. We’ve sent your invites.' } })
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }

  return (
    <Layout>
      <form onSubmit={submit} noValidate>
        <p className="eyebrow">New group</p>
        <h1 ref={heading} tabIndex={-1}>
          Start a group
        </h1>
        <p className="lede">Up to 6 people, including you. Everyone you invite chooses whether to join.</p>

        <div className="card form-card">
          <TextField
            name="name"
            label="Group name"
            hint={`For example, “Lisbon in May”. ${MAX_GROUP_NAME - name.length} characters left.`}
            maxLength={MAX_GROUP_NAME}
            value={name}
            error={shown('name')}
            onChange={(e) => {
              setName(e.target.value)
              touch('name')
            }}
            onBlur={() => touch('name')}
          />
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
          <div className="field-pair">
            <TextField
              name="start"
              label="First day"
              type="date"
              min={today}
              value={start}
              error={shown('start')}
              onChange={(e) => {
                const v = e.target.value
                setStart(v)
                if (v && end && end < v) setEnd(v)
                touch('start')
              }}
              onBlur={() => touch('start')}
            />
            <TextField
              name="end"
              label="Last day"
              type="date"
              min={start || today}
              value={end}
              error={shown('end')}
              onChange={(e) => {
                setEnd(e.target.value)
                touch('end')
              }}
              onBlur={() => touch('end')}
            />
          </div>
          <fieldset className="field" data-field="invite" aria-describedby={shown('invite') ? 'invite-error' : 'invite-hint'}>
            <legend>Who to invite</legend>
            <p className="hint" id="invite-hint">
              {people.length ? `Choose up to ${MAX_GROUP - 1}. ${invite.length} chosen.` : 'Only people you’re connected with can be invited.'}
            </p>
            {people.length === 0 ? (
              <Link to="/people">Find people to travel with</Link>
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
        <ActionBar busy={busy} onBack={() => navigate('/groups')} label="Start group" />
      </form>
    </Layout>
  )
}
