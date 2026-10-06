import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { SafetyBox } from '../components/SafetyBox'
import { SubNav } from '../components/SubNav'
import { CONNECTIONS_NAV } from '../lib/nav'
import { ConnectBox, SharedInterests, useRequests, type Requests } from '../components/Suggestions'
import { messageOf } from '../lib/errors'
import { peek, remember } from '../lib/cache'
import { callouts, clearNotNow, forgetNotNow, loadFeed, notNowIds, saveNotNow, type FeedPerson } from '../lib/feed'
import { noteFirstMatch } from '../lib/kpis'
import { fitWords, homeLabel } from '../lib/matching'
import { ageLabel } from '../lib/options'
import { photoUrl } from '../lib/photo'
import { useSession } from '../lib/session-context'
import { useMyProfile } from '../lib/useMyProfile'

/** The Connections tab: suggested people one at a time, with why they're suggested. */
export function ForYou() {
  const { session } = useSession()
  const me = session!.user.id
  const { data, error: profileError } = useMyProfile(me)
  const requests = useRequests()
  const [people, setPeople] = useState<FeedPerson[] | null>(() => {
    const last = peek<FeedPerson[]>('feed')
    if (!last) return null
    const hidden = notNowIds(me)
    return last.filter((p) => !hidden.has(p.profile_id))
  })
  const [error, setError] = useState<string | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [status, setStatus] = useState<{ text: string; undo?: FeedPerson } | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
    remember('feed', loadFeed()).then(
      (list) => {
        const hidden = notNowIds(me)
        setSkipped(list.filter((p) => hidden.has(p.profile_id)).length)
        setPeople(list.filter((p) => !hidden.has(p.profile_id)))
        if (list.length) noteFirstMatch()
      },
      (e) => setError(messageOf(e)),
    )
  }, [me])

  if (profileError) {
    return (
      <Layout tab="connections">
        <p className="notice notice-error" role="alert">
          {profileError}
        </p>
      </Layout>
    )
  }
  if (!data) return <Loading />
  if (!data.profile.onboarded_at) return <Navigate to="/onboarding" replace />

  const person = people?.[0]

  function next(text: string, undo?: FeedPerson) {
    setPeople((list) => list && list.slice(1))
    setStatus({ text, undo })
  }

  function notNow(p: FeedPerson) {
    saveNotNow(me, p.profile_id)
    setSkipped((n) => n + 1)
    next(`${p.display_name} is hidden for 30 days.`, p)
  }

  function undo(p: FeedPerson) {
    forgetNotNow(me, p.profile_id)
    setSkipped((n) => Math.max(0, n - 1))
    setPeople((list) => [p, ...(list ?? [])])
    setStatus(null)
  }

  function showSkipped() {
    clearNotNow(me)
    setSkipped(0)
    setPeople(null)
    loadFeed().then(setPeople, (e) => setError(messageOf(e)))
  }

  return (
    <Layout tab="connections">
      <div className="page-head">
        <h1 ref={heading} tabIndex={-1}>
          Connections
        </h1>
        <Link className="btn btn-secondary btn-small" to="/filters">
          Filters
        </Link>
      </div>
      <SubNav label="Connections" items={CONNECTIONS_NAV} current="/connections" />
      <p className="visually-hidden" role="status">
        {status?.text}
      </p>
      {status && (
        <p className="feed-toast" aria-hidden="true">
          {status.text}
          {status.undo && (
            <button type="button" className="btn-link" onClick={() => undo(status.undo!)}>
              Undo
            </button>
          )}
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {!error && (!people || !requests) && <p className="hint">Finding people for you…</p>}
      {people && requests && person && (
        <>
          <PersonCard
            key={person.profile_id}
            person={person}
            myHome={data.profile.home_city?.name ?? null}
            requests={requests}
            onNotNow={() => notNow(person)}
            onSent={() => next(`Request sent to ${person.display_name}. We’ll let you know when they reply.`)}
            onBlocked={(message) => next(message)}
          />
          <p className="hint feed-count">
            {people.length > 1 ? `${people.length - 1} more after this.` : 'Last one for now.'} You have {requests.left} of {requests.limit} requests left this week
            {requests.left === 0 ? '; you get more on Monday' : ''}.
          </p>
        </>
      )}
      {people && people.length === 0 && (
        <div className="card empty feed-empty">
          <h2>You’ve seen everyone for now</h2>
          <p>New members join every week. To see more people:</p>
          <ul className="feed-tips">
            <li>
              <Link to="/trips/new">Add a trip</Link> to meet people going to the same place
            </li>
            <li>
              <Link to="/onboarding?step=3">Add more interests</Link>
            </li>
            <li>
              <Link to="/filters">Widen your filters</Link>
            </li>
          </ul>
          {skipped > 0 && (
            <button type="button" className="btn btn-secondary btn-block" onClick={showSkipped}>
              Show the {skipped} {skipped === 1 ? 'person' : 'people'} I said “Not now” to
            </button>
          )}
        </div>
      )}
    </Layout>
  )
}

const SWIPE = 110

function PersonCard({
  person,
  myHome,
  requests,
  onNotNow,
  onSent,
  onBlocked,
}: {
  person: FeedPerson
  myHome: string | null
  requests: Requests
  onNotNow: () => void
  onSent: () => void
  onBlocked: (message: string) => void
}) {
  const [connecting, setConnecting] = useState(false)
  const [drag, setDrag] = useState<{ from: number; x: number } | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const home = homeLabel(person)
  const lines = callouts(person, myHome)
  const x = drag?.x ?? 0

  useEffect(() => {
    if (person.photo_path) photoUrl(person.photo_path).then(setPhoto, () => undefined)
  }, [person.photo_path])

  function down(e: PointerEvent<HTMLDivElement>) {
    if (connecting || e.pointerType === 'mouse') return
    setDrag({ from: e.clientX, x: 0 })
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (drag) setDrag({ ...drag, x: e.clientX - drag.from })
  }
  function up() {
    if (!drag) return
    setDrag(null)
    if (drag.x < -SWIPE) onNotNow()
    else if (drag.x > SWIPE && requests.left > 0) setConnecting(true)
  }

  return (
    <article className={connecting ? 'card person-feed-card is-connecting' : 'card person-feed-card'} aria-labelledby={`name-${person.profile_id}`}>
      <div
        className={drag ? 'feed-photo is-dragging' : 'feed-photo'}
        style={{ transform: x ? `translateX(${x}px) rotate(${x / 25}deg)` : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setDrag(null)}
      >
        {photo ? (
          <img src={photo} alt="" draggable={false} />
        ) : (
          <span className="feed-initial" aria-hidden="true">
            {person.display_name.slice(0, 1).toUpperCase()}
          </span>
        )}
        {x > 40 && <span className="swipe-label swipe-yes">Connect</span>}
        {x < -40 && <span className="swipe-label swipe-no">Not now</span>}
        <div className="feed-who">
          <h2 id={`name-${person.profile_id}`}>
            {person.display_name}
            {person.birth_year ? <span className="feed-age">, {ageLabel(person.birth_year)}</span> : null}
          </h2>
          {home && <p>{home}</p>}
        </div>
        <span className="feed-fit">{fitWords(person.score)}</span>
      </div>
      {lines.length > 0 && (
        <ul className="callouts" aria-label="Why we suggest them">
          {lines.map((c) => (
            <li key={c.text} className={`callout callout-${c.kind}`}>
              {c.text}
            </li>
          ))}
        </ul>
      )}
      {person.shared_interests.length > 0 && <SharedInterests labels={person.shared_interests} />}
      {person.travelling_with && <p className="feed-detail">Travels with: {person.travelling_with}</p>}
      {connecting ? (
        <ConnectBox person={person} tripId={person.trip_id ?? undefined} requests={requests} startOpen onSent={onSent} onCancel={() => setConnecting(false)} />
      ) : (
        <div className="feed-actions">
          <button type="button" className="btn btn-secondary feed-no" onClick={onNotNow} aria-label={`Not now, ${person.display_name}`}>
            <span aria-hidden="true">✕</span> Not now
          </button>
          <button
            type="button"
            className="btn btn-primary feed-yes"
            disabled={requests.left <= 0}
            onClick={() => setConnecting(true)}
            aria-label={`Ask to connect with ${person.display_name}`}
          >
            <span aria-hidden="true">✓</span> {requests.left > 0 ? 'Connect' : 'No requests left'}
          </button>
        </div>
      )}
      <SafetyBox profileId={person.profile_id} name={person.display_name} onBlocked={onBlocked} />
    </article>
  )
}
