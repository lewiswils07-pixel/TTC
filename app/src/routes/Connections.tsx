import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Layout, Loading } from '../components/Layout'
import { tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { homeLabel } from '../lib/matching'
import { myConnections, respondToRequest, withdrawRequest, type Connection } from '../lib/connections'
import { ageLabel } from '../lib/options'

/** Requests for me, requests I've sent, and people I'm connected with. */
export function Connections() {
  const [items, setItems] = useState<Connection[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)

  const load = useCallback(() => myConnections().then(setItems, (e) => setError(messageOf(e))), [])
  useEffect(() => {
    void load()
    heading.current?.focus()
  }, [load])

  async function act(item: Connection, action: () => Promise<void>, done: string) {
    setBusy(item.id)
    setError(null)
    try {
      await action()
      setStatus(done)
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
    <Layout>
      <Link className="back-link" to="/dashboard">
        ‹ My profile
      </Link>
      <h1 ref={heading} tabIndex={-1}>
        Connections
      </h1>
      <p className="lede">Nothing beyond your first name, age and home town is shared until you both say yes.</p>
      <p className="visually-hidden" role="status">
        {status}
      </p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      <h2 className="section-title">Requests for you</h2>
      {received.length === 0 ? (
        <p className="hint section-hint">No new requests.</p>
      ) : (
        <ul className="person-list">
          {received.map((c) => (
            <PersonCard key={c.id} item={c}>
              <div className="action-row">
                <button type="button" className="btn btn-secondary" disabled={busy === c.id} onClick={() => act(c, () => respondToRequest(c.id, false), `You said no thanks to ${c.display_name}.`)}>
                  No thanks
                </button>
                <button type="button" className="btn btn-primary" disabled={busy === c.id} onClick={() => act(c, () => respondToRequest(c.id, true), `You’re now connected with ${c.display_name}.`)}>
                  Accept
                </button>
              </div>
            </PersonCard>
          ))}
        </ul>
      )}

      <h2 className="section-title">Connected</h2>
      {connected.length === 0 ? (
        <p className="hint section-hint">When someone accepts, or you accept them, they’ll appear here. Messaging opens soon.</p>
      ) : (
        <ul className="person-list">
          {connected.map((c) => (
            <PersonCard key={c.id} item={c}>
              <p className="hint">Messaging opens soon.</p>
            </PersonCard>
          ))}
        </ul>
      )}

      <h2 className="section-title">Waiting for a reply</h2>
      {sent.length === 0 ? (
        <p className="hint section-hint">You haven’t sent any requests that are waiting.</p>
      ) : (
        <ul className="person-list">
          {sent.map((c) => (
            <PersonCard key={c.id} item={c}>
              <button
                type="button"
                className="btn-link"
                disabled={busy === c.id}
                onClick={() => window.confirm(`Withdraw your request to ${c.display_name}? It still counts towards this week’s 5.`) && act(c, () => withdrawRequest(c.id), `Request to ${c.display_name} withdrawn.`)}
              >
                Withdraw request
              </button>
            </PersonCard>
          ))}
        </ul>
      )}
    </Layout>
  )
}

function PersonCard({ item, children }: { item: Connection; children: React.ReactNode }) {
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
    </li>
  )
}
