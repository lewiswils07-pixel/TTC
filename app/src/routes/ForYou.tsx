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

/** The Who's going tab: members going where you're going, grouped by trip, then small groups,
 *  then people who travel like you. A calm list to browse, not one face at a time (Lewis, 12 Oct). */
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

  const { trips, others } = groupByTrip(people ?? [])
  const myHome = data.profile.home_city?.name ?? null
  const row = (p: FeedPerson, city?: string) =>
    requests && (
      <PersonRow
        key={p.profile_id}
        person={p}
        city={city}
        myHome={myHome}
        requests={requests}
        onNotNow={() => notNow(p)}
        onSent={(connected) =>
          gone(
            p,
            connected
              ? `${p.display_name} had already said hello to you, so you’re now connected. Carry on in Chat.`
              : `Your hello is on its way to ${p.display_name}. We’ll let you know when they reply.`,
          )
        }
        onBlocked={(message) => gone(p, message)}
      />
    )

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
          {trips.map((g) => {
            const mine = myTrips.find((t) => t.city.name === g.city)
            return (
              <section key={g.city} className="going-trip" aria-labelledby={`trip-${g.city}`}>
                <div className="going-trip-head">
                  <h2 className="section-title" id={`trip-${g.city}`}>
                    {g.city}
                  </h2>
                  <span className="hint">{mine ? `Your trip · ${shortDates(mine.start_date, mine.end_date)}` : monthName(tripTo(g.people[0], g.city)!.start)}</span>
                </div>
                <p className="hint going-trip-count">
                  {g.people.length === 1 ? '1 member going around then' : `${g.people.length} members going around then`}
                  {!requests.plus && (
                    <>
                      {' · '}
                      <Link className="going-plus-link" to="/connections/same-time">
                        See exact days with {brand.plusName}
                      </Link>
                    </>
                  )}
                </p>
                <ul className="person-list going-list">{g.people.map((p) => row(p, g.city))}</ul>
              </section>
            )
          })}

          {myTrips.length === 0 && (
            <div className="card going-add-trip">
              <h2 className="card-title">Where are you off to next?</h2>
              <p className="hint">Add a trip and you’ll see members going to the same place at the same time.</p>
              <Link className="btn btn-primary" to="/trips/new">
                Add a trip
              </Link>
            </div>
          )}

          <section className="going-groups" aria-labelledby="small-groups">
            <h2 className="section-title" id="small-groups">
              Small groups
            </h2>
            <p className="hint section-hint">Travel with 3 or 4 people going your way. Start one for a trip and invite your connections.</p>
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

          {others.length > 0 && (
            <section aria-labelledby="travel-like-you">
              <h2 className="section-title" id="travel-like-you">
                People who travel like you
              </h2>
              <ul className="person-list going-list">{others.map((p) => row(p))}</ul>
            </section>
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
        </>
      )}
    </Layout>
  )
}

/** One member in the list: who they are and what you share. Tap their name to read more; Say hello is tied to the trip. */
function PersonRow({
  person,
  city,
  myHome,
  requests,
  onNotNow,
  onSent,
  onBlocked,
}: {
  person: FeedPerson
  /** The trip you're both going on, when they're listed under one. */
  city?: string
  myHome: string | null
  requests: Requests
  onNotNow: () => void
  onSent: (connected: boolean) => void
  onBlocked: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [hello, setHello] = useState(false)
  const trip = city ? tripTo(person, city) : undefined
  const share = whatYouShare(person, trip)
  const home = homeLabel(person)
  const id = `person-${person.profile_id}`
  const suggested = trip
    ? `Hi ${person.display_name}, I’m going to ${trip.city} in ${monthName(trip.start)} too. Would you like to meet up while we’re there?`
    : `Hi ${person.display_name}, it looks like we enjoy the same kind of travel. Where are you off to next?`

  return (
    <li className="card going-person" aria-labelledby={id}>
      <button type="button" className="going-who" aria-expanded={open} aria-controls={`${id}-more`} onClick={() => setOpen((o) => !o)}>
        <Avatar name={person.display_name} path={person.photo_path} size="md" />
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
      {hello ? (
        <ConnectBox person={person} tripId={person.trip_id ?? undefined} requests={requests} startOpen suggested={suggested} onSent={onSent} onCancel={() => setHello(false)} />
      ) : (
        <div className="action-row going-actions">
          <button type="button" className="btn btn-secondary" onClick={onNotNow} aria-label={`${city ? 'Not for this trip' : 'Not now'}: ${person.display_name}`}>
            {city ? 'Not for this trip' : 'Not now'}
          </button>
          <button type="button" className="btn btn-primary" disabled={requests.left <= 0} onClick={() => setHello(true)} aria-label={`Say hello to ${person.display_name}`}>
            {requests.left > 0 ? 'Say hello' : 'No hellos left this week'}
          </button>
        </div>
      )}
      <SafetyBox profileId={person.profile_id} name={person.display_name} onBlocked={onBlocked} />
    </li>
  )
}

/** More about someone: their trips and travel first, then what they love, then their own words. Loaded when opened. */
function PersonMore({ person, id }: { person: FeedPerson; id: string }) {
  const [places, setPlaces] = useState<string[]>([])
  const [extras, setExtras] = useState<MemberExtras | null>(null)
  const [back, setBack] = useState<CardAnswer[] | 'error' | null>(null)
  useEffect(() => {
    wishlistOf(person.profile_id).then(setPlaces)
    loadExtras(person.profile_id).then(setExtras)
    loadCard(person.profile_id).then(
      (c) => setBack(c.card_answers),
      () => setBack('error'),
    )
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
      <div className="shared-interests">
        <h4>In their own words</h4>
        {back === null ? (
          <SkeletonRows rows={1} label="Loading their answers" />
        ) : back === 'error' ? (
          <p className="hint">We couldn’t load this just now.</p>
        ) : (
          <CardBack name={person.display_name} answers={back} />
        )}
      </div>
    </div>
  )
}
