import { BackIcon } from '../components/Icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { useConfirm } from '../lib/useConfirm'
import { Layout, Loading } from '../components/Layout'
import { SafetyMenu } from '../components/SafetyBox'
import { CityPhoto } from '../components/CityPhoto'
import { UserPlus } from 'lucide-react'
import { myConnections, type Connection } from '../lib/connections'
import { addDays, isoDate, tripDates } from '../lib/dates'
import { CityPicker } from '../components/CityPicker'
import { DateRangePicker } from '../components/DateRangePicker'
import type { City } from '../lib/cities'
import { rules } from '../lib/rules'
import { MAX_TRIP_DAYS, checkTripDates } from '../lib/validation'
import { messageOf } from '../lib/errors'
import {
  groupPeople,
  groupSettings,
  inviteToGroup,
  isTripGroup,
  leaveGroup,
  MAX_GROUP,
  myGroups,
  respondToInvite,
  setGroupTrip,
  type Group,
  type GroupPerson,
  type GroupSettings,
} from '../lib/groups'
import { ageLabel } from '../lib/options'
import { useSession } from '../lib/session-context'
import { SkeletonRows } from '../components/Skeleton'

/** One group: who's in it, where and when (for a trip group), the chat, inviting, removing and leaving. */
export function GroupDetail() {
  const { ask, dialog: confirmDialog } = useConfirm()
  const groupId = Number(useParams().id)
  const { session } = useSession()
  const me = session!.user.id
  const navigate = useNavigate()
  const [group, setGroup] = useState<Group | null | undefined>(undefined)
  const [people, setPeople] = useState<GroupPerson[]>([])
  const [settings, setSettings] = useState<GroupSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>((useLocation().state as { message?: string } | null)?.message ?? null)
  const [busy, setBusy] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [tripOpen, setTripOpen] = useState(useSearchParams()[0].get('trip') === '1')
  const heading = useRef<HTMLHeadingElement>(null)

  const load = useCallback(
    () =>
      Promise.all([myGroups(), groupPeople(groupId), groupSettings(groupId)]).then(
        ([all, p, s]) => {
          setGroup(all?.find((g) => g.id === groupId) ?? null)
          setPeople(p)
          setSettings(s)
        },
        (e) => setError(messageOf(e)),
      ),
    [groupId],
  )

  useEffect(() => {
    void load().then(() => heading.current?.focus())
  }, [load])

  async function act(action: () => Promise<void>, message: string, after?: () => void) {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      await action()
      if (after) after()
      else {
        setDone(message)
        await load()
      }
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  if (group === undefined && !error) return <Loading />
  if (!group) {
    return (
      <Layout>
        <h1>Group not found</h1>
        <p className="lede">You may have left it, or the invite was withdrawn.</p>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <Link className="btn btn-secondary" to="/groups">
          Back to groups
        </Link>
      </Layout>
    )
  }

  const joined = group.my_status === 'joined'
  const others = people.filter((p) => p.profile_id !== me)
  const trip = isTripGroup(group) ? group : null
  const chat = joined && group.conversation_id ? `/messages/${group.conversation_id}` : null

  return (
    <Layout tab="chat">
      {confirmDialog}
      <div className={trip ? 'trip-hero group-hero' : 'trip-hero group-hero is-chat'}>
        {trip && <CityPhoto city={trip.city} width={720} className="trip-hero-photo" />}
        {trip && (
          <span className="trip-hero-code" aria-hidden="true">
            {trip.city.slice(0, 3).toUpperCase()}
          </span>
        )}
        <div className="trip-hero-bar">
          <Link className="trip-hero-btn trip-hero-back" to={chat ?? '/groups'} aria-label={chat ? 'Back to the chat' : 'Back to groups'}>
            <BackIcon />
          </Link>
        </div>
        <div className="trip-hero-text">
          <p className="eyebrow">{trip ? 'Travel group' : 'Group chat'}</p>
          <h1 ref={heading} tabIndex={-1}>
            {group.name}
          </h1>
          <p className="trip-hero-pills">
            {trip && <span className="trip-pill">{tripDates(trip.start_date, trip.end_date)}</span>}
            {settings?.women_only && <span className="trip-pill trip-pill-dark">Women only</span>}
            {settings && (settings.age_min || settings.age_max) && (
              <span className="trip-pill trip-pill-dark">
                {settings.age_min && settings.age_max ? `Ages ${settings.age_min}–${settings.age_max}` : settings.age_min ? `Ages ${settings.age_min}+` : `Ages up to ${settings.age_max}`}
              </span>
            )}
            {settings?.open && <span className="trip-pill trip-pill-dark">Open to join</span>}
          </p>
        </div>
      </div>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="notice notice-success" role="status">
          {done}
        </p>
      )}

      {group.i_own &&
        joined &&
        (tripOpen ? (
          <GroupTripForm
            group={group}
            onCancel={() => setTripOpen(false)}
            onSaved={(message) => {
              setTripOpen(false)
              void act(async () => undefined, message)
            }}
          />
        ) : (
          <button type="button" className="btn btn-secondary btn-block group-trip-btn" onClick={() => setTripOpen(true)}>
            {trip ? 'Change the trip’s place or dates' : 'Make it a trip group'}
          </button>
        ))}

      {joined && chat ? (
        <section className="card person-section group-chat-card" aria-labelledby="group-chat-title">
          <h2 id="group-chat-title">Group chat</h2>
          <p className="hint">{trip ? 'Plan together, share the plan board and compare dates.' : 'Talk together. You can make it a trip group to plan a trip.'}</p>
          <Link className="btn btn-primary btn-block" to={chat}>
            Open group chat
          </Link>
        </section>
      ) : (
        <div className="card group-invite">
          <p>
            <strong>{group.owner_name}</strong> invited you to join.
          </p>
          <div className="action-row">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() =>
                act(
                  () => respondToInvite(group.id, false),
                  '',
                  () => navigate('/groups', { replace: true, state: { message: `You said no thanks to ${group.name}.` } }),
                )
              }
            >
              No thanks
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => respondToInvite(group.id, true), `You’ve joined ${group.name}.`)}>
              Join
            </button>
          </div>
        </div>
      )}

      <section className="card person-section group-members" aria-labelledby="members-title">
        <div className="group-members-head">
          <h2 id="members-title">Members</h2>
          <span className="hint">
            {people.filter((p) => p.status === 'joined').length} of {MAX_GROUP}
          </span>
        </div>
        <ul className="member-rows">
          {people.map((p) => (
            <li key={p.profile_id} className="member-row">
              <Avatar name={p.display_name} path={p.photo_path} size="md" square />
              <span className="member-row-text">
                {p.profile_id !== me && p.status === 'joined' && group.my_status === 'joined' ? (
                  <Link to={`/connections/people/${p.profile_id}`} aria-label={`View ${p.display_name}’s profile`}>
                    <strong>
                      {p.display_name}
                      {p.birth_year ? `, ${ageLabel(p.birth_year)}` : ''}
                    </strong>
                  </Link>
                ) : (
                  <strong>
                    {p.profile_id === me ? `You (${p.display_name})` : p.display_name}
                    {p.profile_id !== me && p.birth_year ? `, ${ageLabel(p.birth_year)}` : ''}
                  </strong>
                )}
                {p.status === 'invited' && <span className="hint">Invited</span>}
                {p.profile_id !== me && group.i_own && (
                  <button
                    type="button"
                    className="btn-link safety-link"
                    disabled={busy}
                    onClick={async () =>
                      (await ask({
                        title: p.status === 'invited' ? `Withdraw ${p.display_name}’s invite?` : `Remove ${p.display_name} from ${group.name}?`,
                        confirmLabel: p.status === 'invited' ? 'Withdraw invite' : 'Remove',
                        danger: true,
                      })) && act(() => leaveGroup(group.id, p.profile_id), `${p.display_name} is no longer in the group.`)
                    }
                  >
                    {p.status === 'invited' ? 'Withdraw invite' : 'Remove from group'}
                  </button>
                )}
              </span>
              {p.role === 'owner' && <span className="going-badge is-gold">Organiser</span>}
              {p.profile_id !== me && <SafetyMenu profileId={p.profile_id} name={p.display_name} onBlocked={(message) => act(async () => undefined, message)} />}
            </li>
          ))}
        </ul>
      </section>
      {others.length === 0 && <p className="hint section-hint">No one else is here yet.</p>}

      {group.i_own && people.length < MAX_GROUP && (
        <InviteMore groupId={group.id} inGroup={people.map((p) => p.profile_id)} room={MAX_GROUP - people.length} open={inviting} setOpen={setInviting} onDone={(m) => act(async () => undefined, m)} />
      )}

      {joined && (
        <button
          type="button"
          className="btn-link btn-danger-link group-leave"
          disabled={busy}
          onClick={async () =>
            (await ask({ title: `Leave ${group.name}?`, message: 'You won’t see the group chat any more.', confirmLabel: 'Leave group', danger: true })) &&
            act(
              () => leaveGroup(group.id),
              '',
              () => navigate('/groups', { replace: true, state: { message: `You left ${group.name}.` } }),
            )
          }
        >
          Leave this group
        </button>
      )}
    </Layout>
  )
}

function InviteMore({
  groupId,
  inGroup,
  room,
  open,
  setOpen,
  onDone,
}: {
  groupId: number
  inGroup: string[]
  room: number
  open: boolean
  setOpen: (open: boolean) => void
  onDone: (message: string) => void
}) {
  const [people, setPeople] = useState<Connection[] | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && !people) myConnections().then((c) => setPeople(c.filter((x) => x.status === 'accepted' && !inGroup.includes(x.profile_id))))
  }, [open, people, inGroup])

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary btn-block group-invite-btn" onClick={() => setOpen(true)}>
        <UserPlus size={20} strokeWidth={1.8} aria-hidden="true" />
        Invite people you’re connected with
      </button>
    )
  }

  async function send() {
    setBusy(true)
    setError(null)
    try {
      await inviteToGroup(groupId, chosen)
      setOpen(false)
      onDone(chosen.length === 1 ? 'Invite sent.' : `${chosen.length} invites sent.`)
    } catch (e) {
      setError(messageOf(e))
      setBusy(false)
    }
  }

  return (
    <section className="card form-card" aria-labelledby="invite-more">
      <h2 id="invite-more" className="section-title">
        Invite more people
      </h2>
      <p className="hint">
        There’s room for {room} more. {chosen.length} chosen.
      </p>
      {!people ? (
        <SkeletonRows rows={2} label="Loading your connections" />
      ) : people.length === 0 ? (
        <p className="hint">Everyone you’re connected with is already here.</p>
      ) : (
        <ul className="invite-list">
          {people.map((p) => {
            const checked = chosen.includes(p.profile_id)
            const full = !checked && chosen.length >= room
            return (
              <li key={p.profile_id}>
                <label className={`invite-option${checked ? ' is-checked' : ''}${full ? ' is-disabled' : ''}`}>
                  <input type="checkbox" checked={checked} disabled={full} onChange={() => setChosen((list) => (checked ? list.filter((x) => x !== p.profile_id) : [...list, p.profile_id]))} />
                  <Avatar name={p.display_name} path={p.photo_path} size="sm" />
                  <span>{p.display_name}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="action-row">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={send} disabled={busy || chosen.length === 0}>
          {busy ? 'Sending…' : 'Send invites'}
        </button>
      </div>
    </section>
  )
}

/** Turn a general group into a trip group, or change its trip. */
function GroupTripForm({ group, onCancel, onSaved }: { group: Group; onCancel: () => void; onSaved: (message: string) => void }) {
  const [today] = useState(() => isoDate(new Date()))
  const [city, setCity] = useState<City | null>(null)
  const [start, setStart] = useState(group.start_date ?? '')
  const [end, setEnd] = useState(group.end_date ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dates = checkTripDates(start, end, today)
  const problem = !city && !group.city_id ? 'Please choose where the group is going.' : (dates.start ?? dates.end)

  async function save() {
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      await setGroupTrip(group.id, city?.id ?? group.city_id!, start, end)
      onSaved(isTripGroup(group) ? 'Trip updated.' : 'It’s a trip group now, with a plan board and everyone’s dates.')
    } catch (e) {
      setError(messageOf(e))
      setBusy(false)
    }
  }

  return (
    <section className="card form-card" aria-labelledby="group-trip">
      <h2 id="group-trip" className="section-title">
        {isTripGroup(group) ? 'Change the trip' : 'Make it a trip group'}
      </h2>
      <p className="hint">Everyone in the group gets the trip added to their trips, and the chat gets a plan board.</p>
      <CityPicker
        label="Destination"
        hint={group.city ? `Now ${group.city}. Pick a new place, or leave it.` : 'Start typing a town or city, then pick it from the list.'}
        value={city}
        onChange={setCity}
      />
      <DateRangePicker
        start={start}
        end={end}
        min={today}
        max={addDays(today, rules.trips.maxDaysAhead)}
        maxDays={MAX_TRIP_DAYS}
        onChange={(s, e) => {
          setStart(s)
          setEnd(e)
        }}
      />
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="action-row">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save trip'}
        </button>
      </div>
    </section>
  )
}
