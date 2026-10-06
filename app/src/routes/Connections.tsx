import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { useConfirm } from '../lib/useConfirm'
import { Layout, Loading } from '../components/Layout'
import { SafetyBox } from '../components/SafetyBox'
import { SubNav } from '../components/SubNav'
import { CONNECTIONS_NAV } from '../lib/nav'
import { refreshTabCounts } from '../lib/tabCounts'
import { myConversations } from '../lib/chat'
import { tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { homeLabel } from '../lib/matching'
import { peek, remember } from '../lib/cache'
import { myConnections, respondToRequest, withdrawRequest, type Connection } from '../lib/connections'
import { ageLabel } from '../lib/options'
import { myBlocks, unblockMember, type BlockedMember } from '../lib/safety'

/** Requests for me, requests I've sent, and people I'm connected with. */
export function Connections() {
  const { ask, dialog: confirmDialog } = useConfirm()
  const [items, setItems] = useState<Connection[] | null>(() => peek('connections') ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | string | null>(null)
  const [status, setStatus] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<BlockedMember[] | null>(() => peek('blocks') ?? null)
  const [chats, setChats] = useState<Map<string, number>>(new Map())
  const heading = useRef<HTMLHeadingElement>(null)

  const load = useCallback(
    () =>
      Promise.all([remember('connections', myConnections()), remember('blocks', myBlocks()), myConversations().catch(() => null)]).then(
        ([c, b, conv]) => {
          setItems(c)
          setBlocked(b)
          setChats(new Map((conv ?? []).flatMap((x) => (x.profile_id ? [[x.profile_id, x.id] as const] : []))))
        },
        (e) => setError(messageOf(e)),
      ),
    [],
  )
  useEffect(() => {
    void load()
    heading.current?.focus()
  }, [load])

  function blockedOne(message: string) {
    setDone(message)
    void load()
  }

  async function act(key: number | string, action: () => Promise<void>, message: string) {
    setBusy(key)
    setError(null)
    setDone(null)
    try {
      await action()
      setStatus(message)
      refreshTabCounts()
      await load()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(null)
    }
  }

  if (!items && !error) return <Loading />
  const received = items?.filter((c) => c.status === 'pending' && c.direction === 'received') ?? []
  const sent = items?.filter((c) => c.status === 'pending' && c.direction === 'sent') ?? []
  const connected = items?.filter((c) => c.status === 'accepted') ?? []

  return (
    <Layout tab="connections">
      {confirmDialog}
      <h1 ref={heading} tabIndex={-1}>
        Connections
      </h1>
      <SubNav label="Connections" items={CONNECTIONS_NAV.map((i) => (i.to === '/connections/requests' ? { ...i, count: received.length } : i))} current="/connections/requests" />
      <p className="lede">Nothing beyond your first name, age and home town is shared until you both say yes.</p>
      <p className="visually-hidden" role="status">
        {status}
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

      <h2 className="section-title">Requests for you</h2>
      {received.length === 0 ? (
        <p className="hint section-hint">No new requests.</p>
      ) : (
        <ul className="person-list">
          {received.map((c) => (
            <PersonCard key={c.id} item={c} onBlocked={blockedOne}>
              <div className="action-row">
                <button type="button" className="btn btn-secondary" disabled={busy === c.id} onClick={() => act(c.id, () => respondToRequest(c.id, false), `You said no thanks to ${c.display_name}.`)}>
                  No thanks
                </button>
                <button type="button" className="btn btn-primary" disabled={busy === c.id} onClick={() => act(c.id, () => respondToRequest(c.id, true), `You’re now connected with ${c.display_name}.`)}>
                  Accept
                </button>
              </div>
            </PersonCard>
          ))}
        </ul>
      )}

      <h2 className="section-title">Connected</h2>
      {connected.length > 0 && (
        <p className="hint section-hint">
          Before you meet, read our tips for <Link to="/meeting-safely">meeting up safely</Link>.
        </p>
      )}
      {connected.length === 0 ? (
        <p className="hint section-hint">When someone accepts, or you accept them, they’ll appear here and you can message each other.</p>
      ) : (
        <ul className="person-list">
          {connected.map((c) => (
            <PersonCard key={c.id} item={c} onBlocked={blockedOne}>
              {chats.has(c.profile_id) ? (
                <Link className="btn btn-primary btn-block" to={`/messages/${chats.get(c.profile_id)}`}>
                  Message {c.display_name}
                </Link>
              ) : (
                <p className="hint">Your chat is being set up. Check Chat in a moment.</p>
              )}
            </PersonCard>
          ))}
        </ul>
      )}

      <h2 className="section-title">Waiting for a reply</h2>
      {sent.length === 0 ? (
        <p className="hint section-hint">No requests waiting for a reply.</p>
      ) : (
        <ul className="person-list">
          {sent.map((c) => (
            <PersonCard key={c.id} item={c} onBlocked={blockedOne}>
              <button
                type="button"
                className="btn-link"
                disabled={busy === c.id}
                onClick={async () =>
                  (await ask({ title: `Withdraw your request to ${c.display_name}?`, message: 'It still counts towards this week’s requests.', confirmLabel: 'Withdraw request' })) &&
                  act(c.id, () => withdrawRequest(c.id), `Request to ${c.display_name} withdrawn.`)}
              >
                Withdraw request
              </button>
            </PersonCard>
          ))}
        </ul>
      )}

      {blocked && blocked.length > 0 && (
        <>
          <h2 className="section-title">Blocked</h2>
          <p className="hint section-hint">You can’t see each other. If you unblock someone, you’ll both see each other again.</p>
          <ul className="blocked-list">
            {blocked.map((b) => (
              <li key={b.profile_id} className="card">
                <span>{b.display_name}</span>
                <button
                  type="button"
                  className="btn-link"
                  disabled={busy === b.profile_id}
                  aria-label={`Unblock ${b.display_name}`}
                  onClick={() => act(b.profile_id, () => unblockMember(b.profile_id), `${b.display_name} is unblocked.`)}
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Layout>
  )
}

function PersonCard({ item, children, onBlocked }: { item: Connection; children: React.ReactNode; onBlocked: (message: string) => void }) {
  const home = homeLabel(item)
  return (
    <li className="card person-card">
      <div className="match-head">
        <Avatar name={item.display_name} path={item.photo_path} />
        <div className="match-who">
          <h3>{item.display_name}</h3>
          <p className="profile-meta">
            {item.birth_year ? `Age ${ageLabel(item.birth_year)}` : null}
            {home && ` · ${home}`}
          </p>
        </div>
      </div>
      {item.trip_city && item.trip_start && item.trip_end && (
        <p className="hint">
          About {item.direction === 'sent' ? 'your' : 'their'} trip to {item.trip_city}, {tripDates(item.trip_start, item.trip_end)}
        </p>
      )}
      {item.note && <blockquote className="person-note">“{item.note}”</blockquote>}
      {children}
      <SafetyBox profileId={item.profile_id} name={item.display_name} onBlocked={onBlocked} />
    </li>
  )
}
