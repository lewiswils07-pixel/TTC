import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { useConfirm } from '../lib/useConfirm'
import { Layout, Loading } from '../components/Layout'
import { SafetyBox } from '../components/SafetyBox'
import { myConnections, type Connection } from '../lib/connections'
import { tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { groupPeople, inviteToGroup, leaveGroup, MAX_GROUP, myGroups, respondToInvite, type Group, type GroupPerson } from '../lib/groups'
import { ageLabel } from '../lib/options'
import { useSession } from '../lib/session-context'

/** One group: where and when, who's in it, the chat, inviting, removing and leaving. */
export function GroupDetail() {
  const { ask, dialog: confirmDialog } = useConfirm()
  const groupId = Number(useParams().id)
  const { session } = useSession()
  const me = session!.user.id
  const navigate = useNavigate()
  const [group, setGroup] = useState<Group | null | undefined>(undefined)
  const [people, setPeople] = useState<GroupPerson[]>([])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>((useLocation().state as { message?: string } | null)?.message ?? null)
  const [busy, setBusy] = useState(false)
  const [inviting, setInviting] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)

  const load = useCallback(
    () =>
      Promise.all([myGroups(), groupPeople(groupId)]).then(
        ([all, p]) => {
          setGroup(all?.find((g) => g.id === groupId) ?? null)
          setPeople(p)
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

  return (
    <Layout>
      {confirmDialog}
      <Link className="back-link" to="/groups">
        ‹ Groups
      </Link>
      <p className="eyebrow">Group</p>
      <h1 ref={heading} tabIndex={-1}>
        {group.name}
      </h1>
      <p className="lede">
        {group.city} · {tripDates(group.start_date, group.end_date)}
      </p>
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

      {joined && group.conversation_id ? (
        <Link className="btn btn-primary btn-block group-chat-link" to={`/messages/${group.conversation_id}`}>
          Open the group chat
        </Link>
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
              onClick={() => act(() => respondToInvite(group.id, false), '', () => navigate('/groups', { replace: true, state: { message: `You said no thanks to ${group.name}.` } }))}
            >
              No thanks
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => respondToInvite(group.id, true), `You’ve joined ${group.name}.`)}>
              Join
            </button>
          </div>
        </div>
      )}

      <h2 className="section-title">
        Who’s in it ({people.filter((p) => p.status === 'joined').length} of {MAX_GROUP})
      </h2>
      <ul className="person-list">
        {people.map((p) => (
          <li key={p.profile_id} className="card person-card">
            <div className="match-head">
              <Avatar name={p.display_name} path={p.photo_path} size="sm" />
              <div className="match-who">
                <h3>{p.profile_id === me ? `${p.display_name} (you)` : p.display_name}</h3>
                <p className="profile-meta">
                  {p.birth_year ? `Age ${ageLabel(p.birth_year)}` : null}
                  {p.role === 'owner' && ' · started the group'}
                  {p.status === 'invited' && ' · invited'}
                </p>
              </div>
            </div>
            {p.profile_id !== me && (
              <div className="person-actions">
                {group.i_own && (
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
                <SafetyBox profileId={p.profile_id} name={p.display_name} onBlocked={(message) => act(async () => undefined, message)} />
              </div>
            )}
          </li>
        ))}
      </ul>
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
            act(() => leaveGroup(group.id), '', () => navigate('/groups', { replace: true, state: { message: `You left ${group.name}.` } }))
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
      <button type="button" className="btn btn-secondary btn-block" onClick={() => setOpen(true)}>
        Invite more people
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
        <p className="hint">Loading your connections…</p>
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
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={full}
                    onChange={() => setChosen((list) => (checked ? list.filter((x) => x !== p.profile_id) : [...list, p.profile_id]))}
                  />
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
