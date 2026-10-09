import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { CardBack } from '../components/CardBack'
import { SafetyBox } from '../components/SafetyBox'
import { SkeletonFeedCard } from '../components/Skeleton'
import { SameTimeStrip } from '../components/SameTimeStrip'
import { Tour } from '../components/Tour'
import { FilterButton } from '../components/FilterBar'
import { ConnectBox, SharedInterests, useRequests, type Requests } from '../components/Suggestions'
import { loadCard, type CardAnswer } from '../lib/card'
import { messageOf } from '../lib/errors'
import { stepLink } from '../lib/onboarding'
import { peek, remember } from '../lib/cache'
import { callouts, clearNotNow, NOT_NOW_DAYS, sameTime, forgetNotNow, loadFeed, notNowIds, saveNotNow, skipMember, skippedCount, unskipAll, unskipMember, type FeedPerson } from '../lib/feed'
import { noteFirstMatch } from '../lib/kpis'
import { requestsLeftText } from '../lib/plan'
import { fitWords, homeLabel } from '../lib/matching'
import { ageLabel, INTERESTS_TO_PICK } from '../lib/options'
import { photoUrl } from '../lib/photo'
import { roughly } from '../lib/rules'
import { useSession } from '../lib/session-context'
import { useMyProfile } from '../lib/useMyProfile'

/** The Connect tab: suggested people one at a time, with why they're suggested. */
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
  const [params, setParams] = useSearchParams()
  const touring = params.get('tour') === '1'

  useEffect(() => {
    heading.current?.focus()
    Promise.all([remember('feed', loadFeed()), skippedCount()]).then(
      ([list, saved]) => {
        const hidden = notNowIds(me)
        setSkipped(Math.max(saved, list.filter((p) => hidden.has(p.profile_id)).length))
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
    void skipMember(p.profile_id)
    setSkipped((n) => n + 1)
    next(`We won’t show ${p.display_name} again for ${roughly(NOT_NOW_DAYS)}.`, p)
  }

  function undo(p: FeedPerson) {
    forgetNotNow(me, p.profile_id)
    void unskipMember(p.profile_id)
    setSkipped((n) => Math.max(0, n - 1))
    setPeople((list) => [p, ...(list ?? [])])
    setStatus(null)
  }

  function refresh() {
    setPeople(null)
    remember('feed', loadFeed()).then(
      (list) => {
        const hidden = notNowIds(me)
        setPeople(list.filter((p) => !hidden.has(p.profile_id)))
      },
      (e) => setError(messageOf(e)),
    )
  }

  function showSkipped() {
    clearNotNow(me)
    setSkipped(0)
    setPeople(null)
    unskipAll()
      .then(() => remember('feed', loadFeed()))
      .then(setPeople, (e) => setError(messageOf(e)))
  }

  return (
    <Layout tab="connections">
      {touring && <Tour onClose={() => setParams({}, { replace: true })} />}
      <div className="connections-top">
        <h1 ref={heading} tabIndex={-1}>
          Connect
        </h1>
        <FilterButton userId={me} onChanged={refresh} />
      </div>
      <div role="status">
        {status && (
          <p className="feed-toast">
            <span>{status.text}</span>
            {status.undo && (
              <button type="button" className="btn-link" onClick={() => undo(status.undo!)}>
                Undo
              </button>
            )}
          </p>
        )}
      </div>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {people && <SameTimeStrip people={people} />}
      {!error && (!people || !requests) && <SkeletonFeedCard label="Finding people for you…" />}
      {people && requests && person && (
        <>
          <PersonCard
            key={person.profile_id}
            person={person}
            myHome={data.profile.home_city?.name ?? null}
            requests={requests}
            onNotNow={() => notNow(person)}
            onSent={(connected) =>
              next(
                connected
                  ? `${person.display_name} had already asked to connect with you, so you’re now connected. Say hello in Chat.`
                  : `Request sent to ${person.display_name}. We’ll let you know when they reply.`,
              )
            }
            onBlocked={(message) => next(message)}
          />
          <p className="hint feed-count">
            {people.length > 1 ? `${people.length - 1} more after this.` : 'Last one for now.'} {requestsLeftText(requests)}
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
              <Link to={stepLink('interests')}>{data.interestIds.length >= INTERESTS_TO_PICK ? 'Swap some of your interests' : 'Add more interests'}</Link>
            </li>
            <li>
              <Link to="/filters">Widen your filters</Link>
            </li>
          </ul>
          {skipped > 0 && (
            <button type="button" className="btn btn-secondary btn-block" onClick={showSkipped}>
              Show the {skipped} {skipped === 1 ? 'person' : 'people'} you skipped
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
  onSent: (connected: boolean) => void
  onBlocked: (message: string) => void
}) {
  const [connecting, setConnecting] = useState(false)
  const [drag, setDrag] = useState<{ from: number; x: number } | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [back, setBack] = useState<CardAnswer[] | 'error' | null>(null)
  const moved = useRef(0)
  const home = homeLabel(person)

  function flip() {
    if (connecting) return
    setFlipped((f) => !f)
    if (back === null || back === 'error') {
      loadCard(person.profile_id).then(
        (c) => setBack(c.card_answers),
        () => setBack('error'),
      )
    }
  }
  const lines = callouts(person, myHome)
  const x = drag?.x ?? 0

  useEffect(() => {
    if (person.photo_path) photoUrl(person.photo_path).then(setPhoto, () => undefined)
  }, [person.photo_path])

  function down(e: PointerEvent<HTMLDivElement>) {
    moved.current = 0
    if (connecting || e.pointerType === 'mouse') return
    setDrag({ from: e.clientX, x: 0 })
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!drag) return
    moved.current = Math.max(moved.current, Math.abs(e.clientX - drag.from))
    setDrag({ ...drag, x: e.clientX - drag.from })
  }
  function up() {
    if (!drag) return
    setDrag(null)
    if (drag.x < -SWIPE) onNotNow()
    else if (drag.x > SWIPE && requests.left > 0) setConnecting(true)
  }

  return (
    <article className={`card person-feed-card${connecting ? ' is-connecting' : ''}${sameTime(person) ? ' is-same-time' : ''}`} aria-labelledby={`name-${person.profile_id}`}>
      <div className={flipped ? 'feed-flip is-flipped' : 'feed-flip'}>
        <div
          className="feed-flip-inner"
          onPointerDown={() => (moved.current = 0)}
          // A tap anywhere on the card turns it over; a swipe or a tap on a link doesn't.
          onClick={(e) => {
            if (moved.current >= 8 || (e.target as HTMLElement).closest('a, button')) return
            flip()
          }}
        >
          <div className="feed-face feed-front" inert={flipped}>
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
                {person.online && (
                  <p className="feed-online">
                    <span aria-hidden="true" /> Recently online
                  </p>
                )}
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
                    {c.hint && <span className="visually-hidden">, {c.hint}</span>}
                  </li>
                ))}
              </ul>
            )}
            {person.shared_interests.length > 0 && <SharedInterests labels={person.shared_interests} />}
            {person.travelling_with && <p className="feed-detail">Travels with: {person.travelling_with}</p>}
          </div>
          <section className="feed-face feed-back" inert={!flipped} aria-label={`The back of ${person.display_name}’s card`}>
            <p className="feed-back-name">
              {person.display_name}
              <span>In their own words</span>
            </p>
            {back === null ? (
              <div className="card-back-empty" role="status">
                <span className="visually-hidden">Loading their answers</span>
                <span className="skeleton skeleton-line" aria-hidden="true" />
                <span className="skeleton skeleton-line skeleton-line-short" aria-hidden="true" />
              </div>
            ) : back === 'error' ? (
              <p className="card-back-empty">We couldn’t load this. Turn the card over to try again.</p>
            ) : (
              <CardBack name={person.display_name} answers={back} />
            )}
          </section>
        </div>
        {!connecting && (
          <button type="button" className="flip-corner" onClick={flip} aria-label={flipped ? `Turn ${person.display_name}’s card back to the front` : `Turn ${person.display_name}’s card over`}>
            <FlipIcon />
          </button>
        )}
      </div>
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
            onClick={() => {
              setFlipped(false)
              setConnecting(true)
            }}
            aria-label={`Ask to connect with ${person.display_name}`}
          >
            <span aria-hidden="true">✓</span> {requests.left > 0 ? 'Connect' : 'No requests left this week'}
          </button>
        </div>
      )}
      <SafetyBox profileId={person.profile_id} name={person.display_name} onBlocked={onBlocked} />
    </article>
  )
}

/** Two curved arrows chasing each other: “turn this over”. */
function FlipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10a8 8 0 0 1 14.3-4.3" />
      <path d="M19 3v3.5h-3.5" />
      <path d="M20 14a8 8 0 0 1-14.3 4.3" />
      <path d="M5 21v-3.5h3.5" />
    </svg>
  )
}
