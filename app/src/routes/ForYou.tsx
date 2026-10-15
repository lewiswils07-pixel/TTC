import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { Avatar } from '../components/Avatar'
import { CardBack } from '../components/CardBack'
import { ProfileExtras } from '../components/ProfileExtras'
import { SafetyMenu } from '../components/SafetyBox'
import { HubRow } from '../components/HubRow'
import { NextIcon } from '../components/Icons'
import { ChevronDown, Repeat2 } from 'lucide-react'
import { SkeletonRows } from '../components/Skeleton'
import { Tour } from '../components/Tour'
import { FirstDayGuide } from '../components/FirstDayGuide'
import { FilterButton } from '../components/FilterBar'
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
  loadFeed,
  nearYou,
  NOT_NOW_DAYS,
  notNowIds,
  saveNotNow,
  skipMember,
  skippedCount,
  sameTime,
  unskipAll,
  unskipMember,
  whatYouShare,
  type FeedPerson,
} from '../lib/feed'
import { isNewMember, loadFirstDay, saveFirstDay } from '../lib/firstDay'
import { groupsICanStart } from '../lib/groups'
import { noteFirstMatch } from '../lib/kpis'
import { requestsLeftText } from '../lib/plan'
import { homeLabel } from '../lib/matching'
import { ageLabel, INTERESTS_TO_PICK } from '../lib/options'
import { preloadPhotos, usePhotoUrl } from '../lib/photo'
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
  const [only, setOnly] = useState<string | null>(() => new URLSearchParams(window.location.search).get('trip'))
  const deckRef = useRef<HTMLElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [status, setStatus] = useState<{ text: string; undo?: FeedPerson } | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [params, setParams] = useSearchParams()
  const touring = params.get('tour') === '1'
  const [firstDay, setFirstDay] = useState(() => loadFirstDay(me))
  const tick = (change: Parameters<typeof saveFirstDay>[1]) => setFirstDay(saveFirstDay(me, change))

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

  const showGuide = isNewMember(data.profile.onboarded_at) && !firstDay.hidden

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

  // Trips are named by your own trip, so someone in nearby Cascais shows under your Lisbon, and every trip of yours has a chip (Ellie, 13 Oct).
  const placeOf = (t: FeedPerson['trips'][number]) => myTrips.find((m) => m.id === t.mine)?.city.name ?? t.city
  const going = (city: string) => (people ?? []).filter((p) => p.trips.some((t) => placeOf(t) === city))
  const places = [...new Set([...myTrips.map((t) => t.city.name), ...(people ?? []).flatMap((p) => p.trips.map(placeOf))])]
  const trips = places.map((city) => ({ city, people: going(city) })).filter((g) => g.people.length || myTrips.some((t) => t.city.name === g.city))
  const myHome = data.profile.home_city?.name ?? null
  // Show the people straight away when a trip is tapped (testers, 13 Oct: the card was off screen).
  function pickTrip(city: string | null) {
    setOnly(city)
    if (city) requestAnimationFrame(() => deckRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const deck = (only ? going(only) : people) ?? []
  const person = deck[0]
  /** The trip they're shown under: the tapped one, or their best one with you. */
  const tripFor = (p: FeedPerson) => (only ? p.trips.find((t) => placeOf(t) === only) : (sameTime(p) ?? p.trips[0]))

  return (
    <Layout tab="connections">
      {touring && <Tour onClose={() => setParams({}, { replace: true })} />}
      <div className="connections-top">
        <h1 ref={heading} tabIndex={-1}>
          Who’s going
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
      {!error && (!people || !requests) && <SkeletonRows rows={3} label="Finding who’s going…" />}

      {people && requests && (
        <>
          {trips.length > 0 && (
            <section aria-labelledby="your-trips" className="going-trips-bar">
              <h2 className="visually-hidden" id="your-trips">
                Going when you are
              </h2>
              {/* One slim scrolling row, so the first person is on screen straight away (testers, 13 Oct). */}
              <ul className="going-trip-list">
                <li>
                  <button type="button" className={only ? 'going-trip-row' : 'going-trip-row is-current'} aria-pressed={!only} onClick={() => pickTrip(null)}>
                    <span className="going-trip-text">
                      <strong>Everyone</strong>
                      <span>{people.length} people</span>
                    </span>
                  </button>
                </li>
                {trips.map((g) => {
                  const mine = myTrips.find((t) => t.city.name === g.city)
                  return (
                    <li key={g.city}>
                      <button
                        type="button"
                        className={only === g.city ? 'going-trip-row is-current' : 'going-trip-row'}
                        aria-pressed={only === g.city}
                        onClick={() => pickTrip(only === g.city ? null : g.city)}
                      >
                        <span className="going-faces" aria-hidden="true">
                          {g.people.slice(0, 2).map((p) => (
                            <Avatar key={p.profile_id} name={p.display_name} path={p.photo_path} size="sm" />
                          ))}
                        </span>
                        <span className="going-trip-text">
                          <strong>{g.city}</strong>
                          <span>
                            {g.people.length ? `${g.people.length} to meet` : 'No one new yet'} ·{' '}
                            {mine ? shortDates(mine.start_date, mine.end_date) : monthName(g.people[0].trips.find((t) => placeOf(t) === g.city)!.start)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {showGuide && !(myTrips.length > 0 && firstDay.read && (firstDay.sent || requests.left < requests.limit)) && (
            <FirstDayGuide hasTrip={myTrips.length > 0} read={!!firstDay.read} sent={!!firstDay.sent || requests.left < requests.limit} onHide={() => tick({ hidden: true })} />
          )}

          {myTrips.length === 0 && !showGuide && (
            <Link className="going-add-trip" to="/trips/new">
              <span>
                <strong>Where are you off to next?</strong>
                <span>Add a trip to see who’s going when you are.</span>
              </span>
              <NextIcon />
            </Link>
          )}

          <section className="going-deck" aria-labelledby="people-title" ref={deckRef}>
            <div className="going-deck-head">
              <h2 className="section-title" id="people-title">
                {only ? `Going to ${only}` : 'People like you'}
              </h2>
              {deck.length > 0 && <span className="going-count">{deck.length === 1 ? 'Last one for now' : `${deck.length} to meet`}</span>}
            </div>
            {person && (
              <div className={deck.length > 1 ? 'going-stack has-next' : 'going-stack'}>
                <PersonCard
                  key={person.profile_id}
                  person={person}
                  trip={tripFor(person)}
                  myCity={(() => {
                    const t = tripFor(person)
                    return t && placeOf(t)
                  })()}
                  myHome={myHome}
                  hasPhoto={!!data.profile.photo_path}
                  requests={requests}
                  onNotNow={() => notNow(person)}
                  onRead={() => !firstDay.read && tick({ read: true })}
                  onSent={(connected) => {
                    tick({ sent: true })
                    gone(
                      person,
                      connected
                        ? `${person.display_name} had already asked to connect with you, so you’re now connected. Say hello in Chat.`
                        : `Request sent to ${person.display_name}. We’ll let you know when they reply.`,
                    )
                  }}
                  onBlocked={(message) => gone(person, message)}
                />
              </div>
            )}
            {requests.left <= 3 && <p className="hint going-left">{requestsLeftText(requests)}</p>}
            {!requests.plus && trips.length > 0 && (
              <p className="hint going-plus-line">
                <Link className="going-plus-link" to="/connections/same-time">
                  See the exact days you overlap with {brand.plusName}
                </Link>
              </p>
            )}
          </section>

          {deck.length === 0 && only && (
            <div className="empty-inline">
              <p>You’ve seen everyone going to {only} for now.</p>
              <button type="button" className="btn btn-secondary" onClick={() => setOnly(null)}>
                Show everyone
              </button>
            </div>
          )}
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

          {/* Groups live on their own page now; one row here (testers, 13 Oct: "Start a group" was on this screen 4 times). */}
          <section className="going-groups" aria-label="Travel groups">
            <HubRow to="/groups" title="Travel groups" text={canStart > 0 ? 'Plan a trip with a few members, or join an open group' : 'Your groups and open groups to join'} />
          </section>
        </>
      )}
    </Layout>
  )
}
/** One member at a time, photo first like the preview of your own card: who they are, what you share, then Connect or Not now.
 *  Read more opens the rest in place; the flip shows their card answers; ⋯ holds block and report (testers, 13 Oct). */
function PersonCard({
  person,
  trip,
  myCity,
  myHome,
  requests,
  onNotNow,
  onRead,
  onSent,
  onBlocked,
  hasPhoto,
}: {
  person: FeedPerson
  hasPhoto: boolean
  /** Their trip near one of yours, if any. */
  trip?: FeedPerson['trips'][number]
  /** Your own trip's place for that trip (theirs may be somewhere near it). */
  myCity?: string
  myHome: string | null
  requests: Requests
  onNotNow: () => void
  /** They opened the card or turned it over (for the first-day guide). */
  onRead: () => void
  onSent: (connected: boolean) => void
  onBlocked: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [back, setBack] = useState<CardAnswer[] | 'error' | null>(null)
  const photo = usePhotoUrl(person.photo_path)
  const share = whatYouShare(person, trip, undefined, myCity)
  const home = homeLabel(person)
  const id = `person-${person.profile_id}`
  const month = trip && monthName(trip.days?.start ?? trip.start)
  const suggested = !trip
    ? `Hi ${person.display_name}, it looks like we enjoy the same kind of travel. Where are you off to next?`
    : myCity && myCity !== trip.city
      ? `Hi ${person.display_name}, I’m going to ${myCity} in ${month} and saw you’ll be in ${trip.city}. Would you like to meet up?`
      : `Hi ${person.display_name}, I’m going to ${trip.city} in ${month} too. Would you like to meet up while we’re there?`

  // The back of the card: the three questions they chose to answer (Lewis, 12 Oct: keep the flip).
  function flip() {
    setFlipped((f) => !f)
    onRead()
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
            <div className={photo ? 'going-photo' : 'going-photo is-empty'} style={photo ? undefined : { ['--hue' as string]: hueOf(person.display_name) }}>
              {photo ? (
                <img src={photo} alt="" />
              ) : (
                <span className="going-initial" aria-hidden="true">
                  {person.display_name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="going-badges">
                {person.online && (
                  <span className="going-badge">
                    <span className="going-dot" aria-hidden="true" />
                    Active today
                  </span>
                )}
                {nearYou(person, myHome) && <span className="going-badge">Near you</span>}
              </div>
              <div className="going-who">
                <h3 id={id}>
                  {person.display_name}
                  {person.birth_year ? <span className="feed-age">, {ageLabel(person.birth_year)}</span> : null}
                </h3>
                {home && <p>{home}</p>}
              </div>
            </div>
            {share.length > 0 && (
              <div className="going-share">
                <h4>What you share</h4>
                <ul className="chip-list">
                  {share.map((s, i) => (
                    <li key={s} className={i === 0 && trip ? 'tag tag-shared' : 'tag'}>
                      {s}
                    </li>
                  ))}
                </ul>
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
      </div>
      <div className="going-tools">
        {!flipped && (
          <button
            type="button"
            className="going-tool"
            aria-expanded={open}
            aria-controls={`${id}-more`}
            onClick={() => {
              setOpen((o) => !o)
              onRead()
            }}
          >
            {open ? 'Show less' : 'Read more'}
            <ChevronDown className={open ? 'icon is-up' : 'icon'} size={18} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="going-tool" onClick={flip} aria-label={flipped ? `Back to ${person.display_name}’s profile` : `See ${person.display_name}’s answers`}>
          <Repeat2 className="icon" size={18} aria-hidden="true" />
          <span aria-hidden="true">{flipped ? 'Back to profile' : 'Their answers'}</span>
        </button>
        <SafetyMenu profileId={person.profile_id} name={person.display_name} onBlocked={onBlocked} />
      </div>
      {connecting ? (
        <ConnectBox
          person={person}
          tripId={trip?.mine ?? person.trip_id ?? undefined}
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

/** A steady colour per name for people without a photo (testers, 13 Oct: every empty card was the same maroon block). */
function hueOf(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}
