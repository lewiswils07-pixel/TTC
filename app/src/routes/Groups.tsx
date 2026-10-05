import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { groupsICanStart, myGroups, respondToInvite, type Group } from '../lib/groups'

/** My groups, invites waiting for an answer, and a way to start one. */
export function Groups() {
  const [groups, setGroups] = useState<Group[] | null | undefined>(undefined)
  const [canStart, setCanStart] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [done, setDone] = useState<string | null>((useLocation().state as { message?: string } | null)?.message ?? null)
  const heading = useRef<HTMLHeadingElement>(null)

  const load = useCallback(
    () =>
      Promise.all([myGroups(), groupsICanStart().catch(() => 0)]).then(
        ([g, n]) => {
          setGroups(g)
          setCanStart(n)
        },
        (e) => setError(messageOf(e)),
      ),
    [],
  )

  useEffect(() => {
    void load().then(() => heading.current?.focus())
  }, [load])

  async function answer(g: Group, accept: boolean) {
    setBusy(g.id)
    setError(null)
    try {
      await respondToInvite(g.id, accept)
      setDone(accept ? `You’ve joined ${g.name}.` : `You said no thanks to ${g.name}.`)
      await load()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(null)
    }
  }

  if (groups === undefined && !error) return <Loading />
  const invites = groups?.filter((g) => g.my_status === 'invited') ?? []
  const joined = groups?.filter((g) => g.my_status === 'joined') ?? []

  return (
    <Layout>
      <Link className="back-link" to="/dashboard">
        ‹ My profile
      </Link>
      <div className="page-head">
        <h1 ref={heading} tabIndex={-1}>
          Groups
        </h1>
        {canStart > 0 && (
          <Link className="btn btn-primary btn-small" to="/groups/new">
            Start a group
          </Link>
        )}
      </div>
      <p className="lede">Travel as a small group of up to 6, made from people you’re connected with. Each group has its own chat.</p>
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

      {invites.length > 0 && (
        <>
          <h2 className="section-title">Invites for you</h2>
          <ul className="person-list">
            {invites.map((g) => (
              <li key={g.id} className="card group-card">
                <GroupSummary group={g} />
                <p className="hint">{g.owner_name} invited you.</p>
                <div className="action-row">
                  <button type="button" className="btn btn-secondary" disabled={busy === g.id} onClick={() => answer(g, false)}>
                    No thanks
                  </button>
                  <button type="button" className="btn btn-primary" disabled={busy === g.id} onClick={() => answer(g, true)}>
                    Join
                  </button>
                </div>
                <Link className="safety-link" to={`/groups/${g.id}`}>
                  See who’s in it
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="section-title">Your groups</h2>
      {joined.length === 0 ? (
        <div className="card empty">
          <p>You’re not in a group yet.</p>
          {canStart > 0 ? (
            <p className="hint">Start one for a trip, and invite up to 5 people you’re connected with.</p>
          ) : (
            <p className="hint">When someone invites you, it will appear here.</p>
          )}
        </div>
      ) : (
        <ul className="person-list">
          {joined.map((g) => (
            <li key={g.id}>
              <Link className="card link-card group-card" to={`/groups/${g.id}`}>
                <span className="trip-text">
                  <GroupSummary group={g} />
                </span>
                <span className="trip-chevron" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {canStart === 0 && joined.some((g) => g.i_own) && (
        <p className="hint section-hint">You can start another group once your current group’s trip is over, or have up to 3 with Sodalis+.</p>
      )}
    </Layout>
  )
}

function GroupSummary({ group }: { group: Group }) {
  return (
    <>
      <strong className="group-name">{group.name}</strong>
      <span className="trip-meta">
        {group.city} · {tripDates(group.start_date, group.end_date)}
      </span>
      <span className="trip-meta">
        {group.members} {group.members === 1 ? 'member' : 'members'}
        {group.i_own ? ' · you started it' : ''}
      </span>
    </>
  )
}
