import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { ChatNav } from '../components/SubNav'
import { tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { brand } from '../lib/brand'
import { rules } from '../lib/rules'
import { peek, remember } from '../lib/cache'
import { OpenGroups } from '../components/OpenGroups'
import { PopularGroups } from '../components/PopularGroups'
import { groupsICanStart, isTripGroup, myGroups, respondToInvite, type Group } from '../lib/groups'
import { UsersRound } from 'lucide-react'
import { listTime, myConversations, type Conversation } from '../lib/chat'

/** My groups and their chats, invites waiting for an answer, and a way to start one. */
export function Groups() {
  const [groups, setGroups] = useState<Group[] | null | undefined>(() => peek('groups'))
  const [canStart, setCanStart] = useState(() => peek<number>('canStart') ?? 0)
  const [conversations, setConversations] = useState<Conversation[] | null | undefined>(() => peek('conversations'))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [done, setDone] = useState<string | null>((useLocation().state as { message?: string } | null)?.message ?? null)
  const heading = useRef<HTMLHeadingElement>(null)

  const load = useCallback(
    () =>
      Promise.all([
        remember('groups', myGroups()),
        remember(
          'canStart',
          groupsICanStart().catch(() => 0),
        ),
      ]).then(
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
    remember('conversations', myConversations()).then(setConversations, () => undefined)
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
  const chats = new Map((conversations ?? []).map((c) => [c.id, c]))

  return (
    <Layout tab="chat">
      <h1 ref={heading} tabIndex={-1}>
        Chat
      </h1>
      <ChatNav current="/groups" />
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

      <h2 className="visually-hidden">Your groups</h2>
      {joined.length === 0 ? (
        <div className="card empty">
          <p>You’re not in a group yet.</p>
          <p className="hint">Chat with people you’re connected with. Make it a trip group to plan together and compare dates.</p>
        </div>
      ) : (
        <ul className="chat-list">
          {joined.map((g) => {
            const chat = g.conversation_id ? chats.get(g.conversation_id) : undefined
            const last = chat?.last_body
              ? `${chat.last_mine ? 'You' : (chat.last_sender ?? 'Someone')}: ${chat.last_body}`
              : isTripGroup(g)
                ? `${g.city} · ${tripDates(g.start_date, g.end_date)}`
                : `${g.members} ${g.members === 1 ? 'member' : 'members'}`
            return (
              <li key={g.id}>
                <Link className={`chat-row${chat?.unread ? ' is-unread' : ''}`} to={g.conversation_id ? `/messages/${g.conversation_id}` : `/groups/${g.id}`}>
                  <span className="avatar avatar-md avatar-square avatar-group" aria-hidden="true">
                    <UsersRound size={24} strokeWidth={1.8} />
                  </span>
                  <span className="chat-row-text">
                    <span className="chat-row-top">
                      <strong>{g.name}</strong>
                      {chat?.last_body && <span className="chat-row-time">{listTime(chat.last_at)}</span>}
                    </span>
                    <span className="chat-row-last">
                      <span>{last}</span>
                      {!!chat?.unread && (
                        <span className="unread-dot">
                          <span className="visually-hidden">{chat.unread} unread</span>
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {canStart > 0 && (
        <Link className="btn btn-secondary btn-block groups-start" to="/groups/new">
          Start a group
        </Link>
      )}
      <OpenGroups />
      <PopularGroups canStart={canStart > 0} />
      {canStart === 0 && joined.some((g) => g.i_own) && (
        <p className="hint section-hint">
          You can start another group once you leave one or its trip is over, or have up to {rules.groups.maxOwnedPlus} with {brand.plusName}.
        </p>
      )}
    </Layout>
  )
}

function GroupSummary({ group }: { group: Group }) {
  return (
    <>
      <strong className="group-name">{group.name}</strong>
      <span className="trip-meta">{isTripGroup(group) ? `${group.city} · ${tripDates(group.start_date, group.end_date)}` : 'Group chat'}</span>
      <span className="trip-meta">
        {group.members} {group.members === 1 ? 'member' : 'members'}
        {group.i_own ? ' · you started it' : ''}
      </span>
    </>
  )
}
