import { useEffect, useRef, useState } from 'react'
import { VerifiedBadge } from '../components/Verified'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Layout, Loading, Logo } from '../components/Layout'
import { CardBack } from '../components/CardBack'
import { PhotoBookStrip } from '../components/ProfileExtras'
import { SafetyMenu } from '../components/SafetyBox'
import { EmptyArt, ErrorState, LoadingState } from '../components/EmptyState'
import { CityPhoto } from '../components/CityPhoto'
import { AddIcon, BackIcon, NextIcon } from '../components/Icons'
import { Blend, ChevronRight, Map as MapIcon, MapPin, Plane, Route, SlidersHorizontal, Sparkles, Tag, UserPlus, UsersRound } from 'lucide-react'
import { Tour } from '../components/Tour'
import { FirstDayGuide } from '../components/FirstDayGuide'
import { FilterButton } from '../components/FilterBar'
import { ConnectBox, useRequests, type Requests } from '../components/Suggestions'
import { brand } from '../lib/brand'
import { loadCard, type CardAnswer } from '../lib/card'
import { monthName, shortDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { stepLink } from '../lib/onboarding'
import { peek, remember } from '../lib/cache'
import { clearNotNow, forgetNotNow, loadFeed, nearYou, NOT_NOW_DAYS, notNowIds, saveNotNow, skipMember, skippedCount, sameTime, unskipAll, unskipMember, type FeedPerson } from '../lib/feed'
import { isNewMember, loadFirstDay, saveFirstDay } from '../lib/firstDay'
import { groupsICanStart, myGroups, type Group } from '../lib/groups'
import { noteFirstMatch } from '../lib/kpis'
import { plusLink, requestsLeftText } from '../lib/plan'
import { fitWords, homeLabel, listLabels, LOTS_IN_COMMON } from '../lib/matching'
import { ageLabel, BOOKING, GROUP_SIZES, HOLIDAY_QUESTIONS, INTERESTS_TO_PICK, labelFor, MOVING, PERSONAL_FIELDS, ROOM_SHARING, TRAVEL_OFTEN } from '../lib/options'
import { preloadPhotos, usePhotoUrl } from '../lib/photo'
import { count, roughly } from '../lib/rules'
import { useSession } from '../lib/session-context'
import { loadExtras, sharedStyle, type MemberExtras } from '../lib/member'
import { listMyTrips, wishlistOf, type Trip } from '../lib/trips'
import { useMyProfile } from '../lib/useMyProfile'
import type { MyProfile } from '../lib/profile'

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
  // Read more opens their full card as its own page; the phone's Back button comes back here (Claude Design, 15 Oct).
  const openId = params.get('person')
  const opened = openId ? people?.find((p) => p.profile_id === openId) : undefined
  function openCard(p: FeedPerson) {
    if (!firstDay.read) tick({ read: true })
    setParams({ person: p.profile_id }, { state: { opened: true } })
  }
  function closeCard() {
    if ((window.history.state as { usr?: { opened?: boolean } } | null)?.usr?.opened) window.history.back()
    else setParams({}, { replace: true })
  }
  const cardProps = (p: FeedPerson) => {
    const t = tripFor(p)
    return {
      person: p,
      trip: t,
      myCity: t && placeOf(t),
      myHome,
      mine: data.profile,
      hasPhoto: !!data.profile.photo_path,
      requests: requests!,
      onNotNow: () => notNow(p),
      onSent: (connected: boolean) => {
        tick({ sent: true })
        gone(
          p,
          connected ? `${p.display_name} had already asked to connect with you, so you’re now connected. Say hello in Chat.` : `Request sent to ${p.display_name}. We’ll let you know when they reply.`,
        )
      },
      onBlocked: (message: string) => gone(p, message),
    }
  }

  if (opened && requests)
    return (
      <Layout tab="connections">
        <PersonPage
          {...cardProps(opened)}
          onBack={closeCard}
          onNotNow={() => {
            closeCard()
            notNow(opened)
          }}
          onSent={(connected) => {
            closeCard()
            cardProps(opened).onSent(connected)
          }}
          onBlocked={(message) => {
            closeCard()
            gone(opened, message)
          }}
        />
      </Layout>
    )

  return (
    <Layout tab="connections">
      {touring && <Tour onClose={() => setParams({}, { replace: true })} />}
      <div className="going-top">
        <span className="going-brand">
          <Logo height={46} />
        </span>
        <h1 ref={heading} tabIndex={-1} className="visually-hidden">
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
      {error && <ErrorState text={`We couldn’t load this just now. ${error}`} onRetry={() => window.location.reload()} />}
      {!error && (!people || !requests) && <LoadingState label="Finding who’s going…" />}

      {people && requests && (
        <>
          <section aria-labelledby="your-trips" className="going-trips-bar">
            <div className="going-head">
              <h2 id="your-trips">Your trips</h2>
              <Link className="going-head-link" to="/trips/new">
                <AddIcon />
                Add a trip
              </Link>
            </div>
            {trips.length > 0 ? (
              // Tap a trip to meet only the people going there; tap it again for everyone (Lewis, 12 Oct).
              <ul className="going-trip-list">
                {trips.map((g) => {
                  const mine = myTrips.find((t) => t.city.name === g.city)
                  const current = only === g.city
                  return (
                    <li key={g.city}>
                      <button type="button" className={current ? 'going-trip-row is-current' : 'going-trip-row'} aria-pressed={current} onClick={() => pickTrip(current ? null : g.city)}>
                        <CityPhoto city={g.city} width={120} code className="going-trip-photo" />
                        <span className="going-trip-text">
                          <strong>{g.city}</strong>
                          <span>
                            {mine ? shortDates(mine.start_date, mine.end_date) : monthName(g.people[0].trips.find((t) => placeOf(t) === g.city)!.start)}
                            {g.people.length > 0 && <span className="visually-hidden">, {g.people.length} to meet</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              !showGuide && (
                <Link className="going-add-trip" to="/trips/new">
                  <span>
                    <strong>Where are you off to next?</strong>
                    <span>Add a trip to see who’s going when you are.</span>
                  </span>
                  <NextIcon />
                </Link>
              )
            )}
          </section>

          {showGuide && !(myTrips.length > 0 && firstDay.read && (firstDay.sent || requests.left < requests.limit)) && (
            <FirstDayGuide hasTrip={myTrips.length > 0} read={!!firstDay.read} sent={!!firstDay.sent || requests.left < requests.limit} onHide={() => tick({ hidden: true })} />
          )}

          <section className="going-deck" aria-labelledby="people-title" ref={deckRef}>
            <div className="going-head going-head-deck">
              <div>
                <h2 id="people-title">{only ? `Going to ${only}` : trips.length ? 'Going your way' : 'People like you'}</h2>
                <p>{only ? 'Members there around your dates.' : trips.length ? 'Members on your trips, and others who travel like you.' : 'Members who travel the way you do.'}</p>
              </div>
              {deck.length > 0 && <span className="going-count">{deck.length === 1 ? 'Last one for now' : `${deck.length} people to meet`}</span>}
            </div>
            {person && (
              <div className={deck.length > 1 ? 'going-stack has-next' : 'going-stack'}>
                <PersonCard key={person.profile_id} {...cardProps(person)} onOpen={() => openCard(person)} />
              </div>
            )}
            {deck.length === 0 && only && people.length > 0 && (
              <div className="empty-state">
                <EmptyArt icon={<MapIcon size={18} strokeWidth={2} />} />
                <h3>You’ve seen everyone going to {only}</h3>
                <p>New members join every week.</p>
                <button type="button" className="btn btn-primary btn-block" onClick={() => setOnly(null)}>
                  Show everyone
                </button>
              </div>
            )}
            {people.length === 0 && (
              <div className="empty-state">
                <EmptyArt icon={<MapIcon size={18} strokeWidth={2} />} />
                <h3>You’ve seen everyone for now</h3>
                <p>New members join every week. Widen your filters or add another trip to meet more people going your way.</p>
                <Link className="btn btn-primary btn-block" to="/filters">
                  <SlidersHorizontal size={20} aria-hidden="true" />
                  Widen your filters
                </Link>
                <Link className="btn btn-secondary btn-block" to="/trips/new">
                  <AddIcon />
                  Add a trip
                </Link>
                {data.interestIds.length < INTERESTS_TO_PICK && (
                  <Link className="btn-link" to={stepLink('interests')}>
                    Add more interests
                  </Link>
                )}
                {skipped > 0 && (
                  <button type="button" className="btn-link" onClick={showSkipped}>
                    Show the {skipped} {skipped === 1 ? 'person' : 'people'} you passed on
                  </button>
                )}
              </div>
            )}
            {requests.left <= 3 && <p className="hint going-left">{requestsLeftText(requests)}</p>}
            {trips.length > 0 && (
              <p className="hint going-plus-line">
                <Link className="going-plus-link" to="/connections/same-time">
                  See the exact days you overlap
                </Link>
              </p>
            )}
          </section>

          <TravelGroups canStart={canStart} />
        </>
      )}
    </Layout>
  )
}

/** Your travel groups under the people, with a way to the rest (Claude Design, 15 Oct). */
function TravelGroups({ canStart }: { canStart: number }) {
  const [groups, setGroups] = useState<Group[] | null>(() => peek<Group[]>('groups') ?? null)
  useEffect(() => {
    remember(
      'groups',
      myGroups().then((g) => g ?? []),
    ).then(setGroups, () => setGroups([]))
  }, [])
  const mine = (groups ?? []).filter((g) => g.my_status === 'joined' && !g.is_pair).slice(0, 3)
  return (
    <section className="going-groups" aria-labelledby="groups-title">
      <div className="going-head going-head-deck">
        <div>
          <h2 id="groups-title">Travel groups</h2>
          <p>{mine.length ? 'Small groups on your trips.' : canStart > 0 ? 'Plan a trip with a few members, or join an open group.' : 'Join an open group going your way.'}</p>
        </div>
        <Link className="going-head-link" to="/groups">
          See all
        </Link>
      </div>
      {mine.length > 0 && (
        <ul className="row-list going-group-list">
          {mine.map((g) => (
            <li key={g.id}>
              <Link className="going-group" to={`/groups/${g.id}`}>
                <span className="going-group-icon" aria-hidden="true">
                  <UsersRound size={24} strokeWidth={1.8} />
                </span>
                <span className="going-group-text">
                  <strong>{g.name}</strong>
                  <span>{[g.start_date && g.end_date ? shortDates(g.start_date, g.end_date) : g.city, `${g.members} going`].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="btn btn-secondary btn-small" aria-hidden="true">
                  View
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type CardProps = {
  person: FeedPerson
  hasPhoto: boolean
  /** Their trip near one of yours, if any. */
  trip?: FeedPerson['trips'][number]
  /** Your own trip's place for that trip (theirs may be somewhere near it). */
  myCity?: string
  myHome: string | null
  /** Your own travel style, to show what you share. */
  mine: MyProfile['profile']
  requests: Requests
  onNotNow: () => void
  onSent: (connected: boolean) => void
  onBlocked: (message: string) => void
}

/** One member at a time, like a travel ticket: why they're here at the top, who they are and what you share,
 *  then Read more (their full card on its own page) and Connect or Not now. ⋯ holds block and report (Claude Design, 15 Oct). */
function PersonCard(props: CardProps & { onOpen: () => void }) {
  const { person, trip, myCity, mine, onOpen, onBlocked } = props
  const [extras, setExtras] = useState<MemberExtras | null>(null)
  useEffect(() => {
    loadExtras(person.profile_id).then(setExtras)
  }, [person.profile_id])
  const id = `person-${person.profile_id}`
  const month = trip && monthName(trip.days?.start ?? trip.start)
  const near = !!(trip && myCity && myCity !== trip.city)
  const banner = trip
    ? {
        title: near ? `Going to ${trip.city} in ${month}` : `Also going to ${trip.city} in ${month}`,
        text: trip.days ? `Your dates overlap ${shortDates(trip.days.start, trip.days.end)}` : near ? `Near your ${myCity} trip` : trip.overlap ? 'There at the same time as you' : 'Near your dates',
      }
    : {
        title: 'Travels the way you do',
        text: person.shared_interests.length ? `${count(person.shared_interests.length, 'interest')} in common` : fitWords(person.score),
      }
  const style = sharedStyle(extras, mine)
  const shares = [
    person.shared_interests.length > 0 && {
      Icon: Tag,
      label: 'Interests',
      text: listLabels(
        person.shared_interests.map((x) => x.toLowerCase()),
        4,
      ),
    },
    person.shared_places.length > 0 && { Icon: MapPin, label: 'Places', text: `you both want to see ${listLabels(person.shared_places, 3)}` },
    style.length > 0 && { Icon: Route, label: 'Travel style', text: listLabels(style, 3) },
  ].filter((x) => !!x)

  return (
    <article className="card going-person" aria-labelledby={id}>
      <div className="going-banner">
        <span className="going-banner-icon" aria-hidden="true">
          {trip ? <Plane size={20} strokeWidth={1.8} /> : <Sparkles size={20} strokeWidth={1.8} />}
        </span>
        <span className="going-banner-text">
          <strong>{banner.title}</strong>
          <span>{banner.text}</span>
        </span>
        <SafetyMenu profileId={person.profile_id} name={person.display_name} onBlocked={onBlocked} />
      </div>
      <div className="going-tear" aria-hidden="true" />
      <PersonHead person={person} myHome={props.myHome} id={id} />
      {extras?.headline && <p className="going-headline">“{extras.headline}”</p>}
      {shares.length > 0 && (
        <div className="going-share">
          <h4>What you share</h4>
          <ul>
            {shares.map(({ Icon, label, text }) => (
              <li key={label}>
                <span className="going-share-icon" aria-hidden="true">
                  <Icon size={19} strokeWidth={1.8} />
                </span>
                <p>
                  <strong>{label}</strong> · {text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" className="going-more" onClick={onOpen}>
        Read more about {person.display_name}
        <ChevronRight size={20} aria-hidden="true" />
      </button>
      <PersonActions {...props} />
    </article>
  )
}

/** Their photo, name, age and home, and the badges. */
function PersonHead({ person, myHome, id, level = 3 }: { person: FeedPerson; myHome: string | null; id: string; level?: 1 | 3 }) {
  const photo = usePhotoUrl(person.photo_path)
  const H = level === 1 ? 'h1' : 'h3'
  return (
    <div className="going-main">
      <div className={photo ? 'going-photo' : 'going-photo is-empty'} style={photo ? undefined : { ['--hue' as string]: hueOf(person.display_name) }}>
        {photo ? (
          <img src={photo} alt="" />
        ) : (
          <span className="going-initial" aria-hidden="true">
            {person.display_name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="going-who">
        <H id={id} tabIndex={level === 1 ? -1 : undefined}>
          {person.display_name}
        </H>
        <p>{[person.birth_year && ageLabel(person.birth_year), homeLabel(person)].filter(Boolean).join(' · ')}</p>
        <div className="going-badges">
          {person.verified && <VerifiedBadge />}
          {person.score >= LOTS_IN_COMMON && (
            <span className="going-badge is-gold">
              <Blend size={16} strokeWidth={2} aria-hidden="true" />
              Lots in common
            </span>
          )}
          {nearYou(person, myHome) && (
            <span className="going-badge">
              <MapPin size={16} strokeWidth={2} aria-hidden="true" />
              Near you
            </span>
          )}
          {person.online && (
            <span className="going-badge">
              <span className="going-dot" aria-hidden="true" />
              Active today
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Not now and Connect, or the note to send with a request. */
function PersonActions({ person, trip, myCity, requests, hasPhoto, onNotNow, onSent, page = false }: CardProps & { page?: boolean }) {
  const [connecting, setConnecting] = useState(false)
  const month = trip && monthName(trip.days?.start ?? trip.start)
  const near = !!(trip && myCity && myCity !== trip.city)
  const suggested = !trip
    ? `Hi ${person.display_name}, it looks like we enjoy the same kind of travel. Where are you off to next?`
    : near
      ? `Hi ${person.display_name}, I’m going to ${myCity} in ${month} and saw you’ll be in ${trip.city}. Would you like to meet up?`
      : `Hi ${person.display_name}, I’m going to ${trip.city} in ${month} too. Would you like to meet up while we’re there?`
  if (connecting)
    return (
      <div className={page ? 'person-connect' : undefined}>
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
      </div>
    )
  return (
    <div className={page ? 'going-actions person-actions' : 'going-actions'}>
      <div className="action-row">
        <button type="button" className="btn btn-secondary" onClick={onNotNow} aria-label={`Not now: ${person.display_name}`}>
          Not now
        </button>
        <button type="button" className="btn btn-primary" disabled={requests.left <= 0} onClick={() => setConnecting(true)} aria-label={`Connect with ${person.display_name}`}>
          {requests.left > 0 && <UserPlus size={20} strokeWidth={2} aria-hidden="true" />}
          {requests.left > 0 ? 'Connect' : 'No requests left this week'}
        </button>
      </div>
      {!page && (
        <p className="hint">
          {trip ? `Connect sends a hello, to plan ${myCity ?? trip.city} together.` : 'Connect sends a friendly hello.'} Not now hides {person.display_name} for {NOT_NOW_DAYS} days, and they’re never
          told.
        </p>
      )}
    </div>
  )
}

/** Someone's full card on its own page, opened from Read more: trips you share, where they'd love to go,
 *  their own words, how they travel and their holiday preferences (Claude Design, 15 Oct). */
function PersonPage(props: CardProps & { onBack: () => void }) {
  const { person, onBack, onBlocked } = props
  const [places, setPlaces] = useState<string[]>([])
  const [extras, setExtras] = useState<MemberExtras | null>(null)
  const [answers, setAnswers] = useState<CardAnswer[] | 'error' | null>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    document.getElementById('person-name')?.focus()
    wishlistOf(person.profile_id).then(setPlaces)
    loadExtras(person.profile_id).then(setExtras)
    loadCard(person.profile_id).then(
      (c) => setAnswers(c.card_answers),
      () => setAnswers('error'),
    )
  }, [person.profile_id])
  const name = person.display_name
  const style = extras
    ? [
        { label: 'Moving around', value: extras.moving, options: MOVING },
        { label: 'How often', value: extras.travel_often, options: TRAVEL_OFTEN },
        { label: 'Booking', value: extras.booking, options: BOOKING },
        { label: 'Group size', value: extras.group_size, options: GROUP_SIZES },
        { label: 'Room sharing', value: extras.room_sharing ?? null, options: ROOM_SHARING },
      ].filter((r) => r.value)
    : []
  const holiday = extras?.holiday_prefs
    ? HOLIDAY_QUESTIONS.flatMap((q) => {
        const picked = q.options.filter((o) => extras.holiday_prefs?.[q.key]?.includes(o.value)).map((o) => o.label)
        return picked.length ? [{ label: q.label, value: picked.join(', ') }] : []
      })
    : []
  const personal = extras ? PERSONAL_FIELDS.flatMap((f) => f.options.filter((o) => o.value === extras[f.key]).map((o) => o.label)) : []

  return (
    <article className="person-page" aria-labelledby="person-name">
      <div className="person-top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back to Who’s going">
          <BackIcon />
        </button>
        <p className="person-top-title">{name}’s card</p>
        <SafetyMenu profileId={person.profile_id} name={name} onBlocked={onBlocked} />
      </div>
      <PersonHead person={person} myHome={props.myHome} id="person-name" level={1} />
      {extras?.headline && <p className="going-headline is-page">“{extras.headline}”</p>}
      {person.travelling_with && (
        <p className="tip-box">
          <UsersRound size={20} strokeWidth={1.8} aria-hidden="true" />
          <span>Travels with: {person.travelling_with}</span>
        </p>
      )}
      {person.trips.length > 0 && (
        <section className="card person-section" aria-labelledby="person-trips">
          <h2 id="person-trips">Trips you have in common</h2>
          <ul className="going-common">
            {person.trips.map((t) => (
              <li key={t.city + t.start}>
                <CityPhoto city={t.city} width={120} code className="going-trip-photo" />
                <span>
                  <strong>
                    {t.city} · {t.days ? `together ${shortDates(t.days.start, t.days.end)}` : monthName(t.start)}
                  </strong>
                  <span className="hint">{t.exact ? `Their dates ${shortDates(t.start, t.end)}` : t.overlap ? 'There at the same time as you' : 'Near your dates'}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {places.length > 0 && (
        <section className="card person-section" aria-labelledby="person-places">
          <h2 id="person-places">Places they’d love to go</h2>
          <ul className="chip-list">
            {places.map((place) => (
              <li key={place} className={person.shared_places.includes(place) ? 'tag tag-place is-shared' : 'tag tag-place'}>
                {place}
                {person.shared_places.includes(place) && ' · you too'}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card person-section going-words" aria-labelledby="person-words">
        <h2 id="person-words">In their words</h2>
        {answers === null ? (
          <div className="card-back-empty" role="status">
            <span className="visually-hidden">Loading their answers</span>
            <span className="skeleton skeleton-line" aria-hidden="true" />
            <span className="skeleton skeleton-line skeleton-line-short" aria-hidden="true" />
          </div>
        ) : answers === 'error' ? (
          <p className="card-back-empty">We couldn’t load this just now.</p>
        ) : (
          <CardBack name={name} answers={answers} />
        )}
      </section>
      {style.length > 0 && (
        <section className="card person-section" aria-labelledby="person-style">
          <h2 id="person-style">Their travel style</h2>
          <dl className="style-rows">
            {style.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>{labelFor(r.options as readonly { value: string; label: string }[], r.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {(holiday.length > 0 || extras?.holiday_locked) && (
        <section className="card person-section" aria-labelledby="person-holiday">
          <h2 id="person-holiday">Holiday preferences</h2>
          {holiday.length > 0 && (
            <dl className="style-rows">
              {holiday.map((r) => (
                <div key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {extras?.holiday_locked && (
            <Link className="plus-teaser" to={plusLink('card')}>
              <span className="tag tag-plus">{brand.plusName}</span> See how {name} likes to holiday
            </Link>
          )}
        </section>
      )}
      {extras && extras.photo_book.length > 0 && (
        <section className="card person-section" aria-labelledby="person-photos">
          <h2 id="person-photos">Photo book</h2>
          <PhotoBookStrip paths={extras.photo_book} name={name} />
        </section>
      )}
      {personal.length > 0 && (
        <ul className="chip-list personal-tags" aria-label={`More about ${name}`}>
          {personal.map((label) => (
            <li key={label} className="tag">
              {label}
            </li>
          ))}
        </ul>
      )}
      <PersonActions {...props} page />
    </article>
  )
}

/** A steady colour per name for people without a photo (testers, 13 Oct: every empty card was the same maroon block). */
function hueOf(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}
