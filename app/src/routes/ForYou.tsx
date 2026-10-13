import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { Avatar } from '../components/Avatar'
import { CardBack } from '../components/CardBack'
import { ProfileExtras } from '../components/ProfileExtras'
import { SafetyBox } from '../components/SafetyBox'
import { SkeletonRows } from '../components/Skeleton'
import { Tour } from '../components/Tour'
import { FilterButton } from '../components/FilterBar'
import { PopularGroups } from '../components/PopularGroups'
import { ConnectBox, SharedInterests, useRequests, type Requests } from '../components/Suggestions'
import { brand } from '../lib/brand'
import { loadCard, type CardAnswer } from '../lib/card'
import { monthName, shortDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { stepLink } from '../lib/onboarding'
import { peek, remember } from '../lib/cache'
import {
  clearNotNow,
  forgetNotNow,
  groupByTrip,
  loadFeed,
  nearYou,
  NOT_NOW_DAYS,
  notNowIds,
  saveNotNow,
  skipMember,
  skippedCount,
  sameTime,
  tripTo,
  unskipAll,
  unskipMember,
  whatYouShare,
  type FeedPerson,
} from '../lib/feed'
import { groupsICanStart } from '../lib/groups'
import { noteFirstMatch } from '../lib/kpis'
import { requestsLeftText } from '../lib/plan'
import { homeLabel } from '../lib/matching'
import { ageLabel, INTERESTS_TO_PICK } from '../lib/options'
import { preloadPhotos } from '../lib/photo'
import { roughly } from '../lib/rules'
import { useSession } from '../lib/session-context'
import { loadExtras, type MemberExtras } from '../lib/member'
import { listMyTrips, wishlistOf, type Trip } from '../lib/trips'
import { useMyProfile } from '../lib/useMyProfile'

/** The Who's going tab: your trips and who's going, travel groups, then people one card at a time
 *  with Connect and Not now. Tap a trip to see only people going there (Lewis, 12 Oct). */
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
  const [myTrips, setMyTrips] = useState<Trip[]>([])
  const [canStart, setCanStart] = useState(0)
  /** A trip tapped at the top: the cards then show only people going there. */
  const [only, setOnly] = useState<string | null>(null)
  const deckRef = useRef<HTMLElement>(null)
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
    listMyTrips().then(
      (t) => setMyTrips(t ?? []),
      () => {},
    )
    groupsICanStart().then(setCanStart, () => {})
  }, [me])
  useEffect(() => {
    if (people) preloadPhotos(people.slice(0, 8).map((p) => p.photo_path))
  }, [people])

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

  function gone(p: FeedPerson, text: string, undo?: FeedPerson) {
    setPeople((list) => list && list.filter((x) => x.profile_id !== p.profile_id))
    setStatus({ text, undo })
  }

  function notNow(p: FeedPerson) {
    saveNotNow(me, p.profile_id)
    void skipMember(p.profile_id)
    setSkipped((n) => n + 1)
    gone(p, `We won’t show ${p.display_name} again for ${roughly(NOT_NOW_DAYS)}.`, p)
  }

  function undo(p: FeedPerson) {
    forgetNotNow(me, p.profile_id)
    void unskipMember(p.profile_id)
    setSkipped((n) => Math.max(0, n - 1))
    remember('feed', loadFeed()).then((list) => {
      const hidden = notNowIds(me)
      setPeople(list.filter((x) => !hidden.has(x.profile_id)))
    })
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

  const { trips } = groupByTrip(people ?? [])
  const myHome = data.profile.home_city?.name ?? null
  // Show the people straight away when a trip is tapped (testers, 13 Oct: the card was off screen).
  function pickTrip(city: string | null) {
    setOnly(city)
    if (city) requestAnimationFrame(() => deckRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const deck = (only ? trips.find((g) => g.city === only)?.people : people) ?? []
  const person = deck[0]
  const cityOf = (p: FeedPerson) => only ?? (sameTime(p) ?? p.trips[0])?.city

  return (
    <Layout tab="connections">
      {touring && <Tour onClose={() => setParams({}, { replace: true })} />}
      <div className="connections-top">
        <h1 ref={heading} tabIndex={-1}>
          Who’s going
        </h1>
        <FilterButton userId={me} onChanged={refresh} />
      </div>
      <p className="hint going-intro">Members going where you’re going, and people who travel like you. {requests && requestsLeftText(requests)}</p>
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
      {!error && (!people || !requests) && <SkeletonRows rows={3} label="Finding who’s going…" />}

      {people && requests && (
        <>
          {trips.length > 0 && (
            <section aria-labelledby="your-trips">
              <h2 className="section-title" id="your-trips">
                Going when you are
              </h2>
              <ul className="going-trip-list">
                {trips.map((g) => {
                  const mine = myTrips.find((t) => t.city.name === g.city)
                  return (
                    <li key={g.city}>
                      <button
                        type="button"
                        className={only === g.city ? 'card going-trip-row is-current' : 'card going-trip-row'}
                        aria-pressed={only === g.city}
                        onClick={() => pickTrip(only === g.city ? null : g.city)}
                      >
                        <span className="going-trip-text">
                          <strong>{g.city}</strong>
                          <span className="hint">{mine ? `Your trip · ${shortDates(mine.start_date, mine.end_date)}` : monthName(tripTo(g.people[0], g.city)!.start)}</span>
                        </span>
                        <span className="going-faces" aria-hidden="true">
                          {g.people.slice(0, 3).map((p) => (
                            <Avatar key={p.profile_id} name={p.display_name} path={p.photo_path} size="sm" />
                          ))}
                        </span>
                        <span className="going-trip-count">{g.people.length} going</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {!requests.plus && (
                <p className="hint going-plus-line">
                  <Link className="going-plus-link" to="/connections/same-time">
                    See the exact days you overlap with {brand.plusName}
                  </Link>
                </p>
              )}
            </section>
          )}

          {myTrips.length === 0 && (
            <div className="card going-add-trip">
              <h2 className="card-title">Where are you off to next?</h2>
              <p className="hint">Add a trip and you’ll see members going to the same place at the same time.</p>
              <Link className="btn btn-primary" to="/trips/new">
                Add a trip
              </Link>
            </div>
          )}

          <section className="going-deck" aria-labelledby="people-title" ref={deckRef}>
            <div className="going-deck-head">
              <h2 className="section-title" id="people-title">
                {only ? `Going to ${only}` : 'People like you'}
              </h2>
              {deck.length > 0 && <span className="hint">1 of {deck.length}</span>}
            </div>
            {only && deck.length > 0 && (
              <p className="hint going-showing">
                Showing {deck.length === 1 ? '1 person' : `${deck.length} people`} going to {only}
              </p>
            )}
            {only && (
              <button type="button" className="btn-link going-show-all" onClick={() => setOnly(null)}>
                Show everyone
              </button>
            )}
            {person && (
              <div className={deck.length > 1 ? 'going-stack has-next' : 'going-stack'}>
                <PersonCard
                  key={person.profile_id}
                  person={person}
                  city={cityOf(person)}
                  myHome={myHome}
                  hasPhoto={!!data.profile.photo_path}
                  requests={requests}
                  onNotNow={() => notNow(person)}
                  onSent={(connected) =>
                    gone(
                      person,
                      connected
                        ? `${person.display_name} had already asked to connect with you, so you’re now connected. Say hello in Chat.`
                        : `Request sent to ${person.display_name}. We’ll let you know when they reply.`,
                    )
                  }
                  onBlocked={(message) => gone(person, message)}
                />
              </div>
            )}
          </section>

          {deck.length === 0 && only && <p className="hint">You’ve seen everyone going to {only} for now.</p>}
          {people.length === 0 && (
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
                  Show the {skipped} {skipped === 1 ? 'person' : 'people'} you passed on
                </button>
              )}
            </div>
          )}

          <section className="going-groups" aria-labelledby="travel-groups">
            <h2 className="section-title" id="travel-groups">
              Travel groups
            </h2>
            <div className="action-row going-groups-actions">
              <Link className="btn btn-secondary" to="/groups">
                Your groups
              </Link>
              {canStart > 0 && (
                <Link className="btn btn-primary" to="/groups/new">
                  Start a group
                </Link>
              )}
            </div>
            <PopularGroups canStart={canStart > 0} />
          </section>
        </>
      )}
    </Layout>
  )
}

/** One member at a time: who they are and what you share. Read more opens the card in place; Connect is tied to the trip. */
function PersonCard({
  person,
  city,
  myHome,
  requests,
  onNotNow,
  onSent,
  onBlocked,
  hasPhoto,
}: {
  person: FeedPerson
  hasPhoto: boolean
  /** The trip you're both going on, if any. */
  city?: string
  myHome: string | null
  requests: Requests
  onNotNow: () => void
  onSent: (connected: boolean) => void
  onBlocked: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [back, setBack] = useState<CardAnswer[] | 'error' | null>(null)
  const trip = city ? tripTo(person, city) : undefined
  const share = whatYouShare(person, trip)
  const home = homeLabel(person)
  const id = `person-${person.profile_id}`
  const suggested = trip
    ? `Hi ${person.display_name}, I’m going to ${trip.city} in ${monthName(trip.days?.start ?? trip.start)} too. Would you like to meet up while we’re there?`
    : `Hi ${person.display_name}, it looks like we enjoy the same kind of travel. Where are you off to next?`

  // The back of the card: the three questions they chose to answer (Lewis, 12 Oct: keep the flip).
  function flip() {
    setFlipped((f) => !f)
    if (back === null || back === 'error') {
      loadCard(person.profile_id).then(
        (c) => setBack(c.card_answers),
        () => setBack('error'),
      )
    }
  }

  return (
    <article className={open ? 'card going-person is-open' : 'card going-person'} aria-labelledby={id}>
      <div className={flipped ? 'feed-flip going-flip is-flipped' : 'feed-flip going-flip'}>
        <div className="feed-flip-inner">
          <div className="feed-face going-front" inert={flipped}>
            <button type="button" className="going-who" aria-expanded={open} aria-controls={`${id}-more`} onClick={() => setOpen((o) => !o)}>
              <Avatar name={person.display_name} path={person.photo_path} size={open ? 'lg' : 'md'} />
              <span className="going-name">
                <strong id={id}>
                  {person.display_name}
                  {person.birth_year ? `, ${ageLabel(person.birth_year)}` : ''}
                </strong>
                <span className="hint">{[home, nearYou(person, myHome) ? 'Near you' : null, person.online ? 'Active today' : null].filter(Boolean).join(' · ')}</span>
                <span className="going-more">{open ? 'Show less' : 'Read more'}</span>
              </span>
            </button>
            {share.length > 0 && (
              <div className="going-share">
                <h3>What you share</h3>
                <p>{share.join(' · ')}</p>
              </div>
            )}
            {open && <PersonMore person={person} id={`${id}-more`} />}
          </div>
          <section className="feed-face feed-back" inert={!flipped} aria-label={`The back of ${person.display_name}’s card`}>
            <p className="feed-back-name">
              {person.display_name}
              <span>Their answers</span>
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
        <button
          type="button"
          className="flip-corner going-flip-btn"
          onClick={flip}
          aria-label={flipped ? `Turn ${person.display_name}’s card back to the front` : `Turn ${person.display_name}’s card over`}
        >
          <FlipIcon />
          <span aria-hidden="true">{flipped ? 'Front' : 'Their answers'}</span>
        </button>
      </div>
      {connecting ? (
        <ConnectBox
          person={person}
          tripId={person.trip_id ?? undefined}
          requests={requests}
          startOpen
          needsPhoto={!hasPhoto}
          suggested={suggested}
          onSent={onSent}
          onCancel={() => setConnecting(false)}
        />
      ) : (
        <div className="action-row going-actions">
          <button type="button" className="btn btn-secondary" onClick={onNotNow} aria-label={`Not now: ${person.display_name}`}>
            Not now
          </button>
          <button type="button" className="btn btn-primary" disabled={requests.left <= 0} onClick={() => setConnecting(true)} aria-label={`Connect with ${person.display_name}`}>
            {requests.left > 0 ? 'Connect' : 'No requests left this week'}
          </button>
        </div>
      )}
      <SafetyBox profileId={person.profile_id} name={person.display_name} onBlocked={onBlocked} />
    </article>
  )
}

/** More about someone: their trips and how they holiday first, then what they love. Loaded when opened. */
function PersonMore({ person, id }: { person: FeedPerson; id: string }) {
  const [places, setPlaces] = useState<string[]>([])
  const [extras, setExtras] = useState<MemberExtras | null>(null)
  useEffect(() => {
    wishlistOf(person.profile_id).then(setPlaces)
    loadExtras(person.profile_id).then(setExtras)
  }, [person.profile_id])

  return (
    <div className="going-details" id={id}>
      {person.trips.length > 0 && (
        <div className="shared-interests">
          <h4>Trips you have in common</h4>
          <ul className="going-trips">
            {person.trips.map((t) => (
              <li key={t.city + t.start}>
                <span>{t.city}</span>
                <span className="hint">{t.exact ? shortDates(t.start, t.end) : monthName(t.start)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ProfileExtras extras={extras} name={person.display_name} />
      {person.travelling_with && <p className="feed-detail">Travels with: {person.travelling_with}</p>}
      {person.shared_interests.length > 0 && <SharedInterests labels={person.shared_interests} />}
      {places.length > 0 && (
        <div className="shared-interests">
          <h4>Places they’d love to go</h4>
          <ul className="chip-list">
            {places.map((place) => (
              <li key={place} className="tag tag-place">
                {place}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
