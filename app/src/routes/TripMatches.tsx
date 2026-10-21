import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { Link, useParams, useSearchParams } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { CityTips } from '../components/CityTips'
import { DateOverlap } from '../components/DateOverlap'
import { OpenGroups } from '../components/OpenGroups'
import { CityPhoto } from '../components/CityPhoto'
import { ShareTrip } from '../components/ShareTrip'
import { TripPlanner } from '../components/TripPlanner'
import { picksFor } from '../data/picks'
import { cityLabel } from '../lib/cities'
import { isoDate, shortDates, tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { homeLabel, tripCompanions, type TripCompanion } from '../lib/matching'
import { ageLabel } from '../lib/options'
import { Avatar } from '../components/Avatar'
import { getTrip, type Trip } from '../lib/trips'
import { BackIcon } from '../components/Icons'
import { Pencil, UsersRound } from 'lucide-react'
import { remember } from '../lib/cache'
import { loadFeed } from '../lib/feed'

type Tab = 'people' | 'plan' | 'tips'
const TABS: { key: Tab; label: string }[] = [
  { key: 'people', label: 'People' },
  { key: 'plan', label: 'My plan' },
  { key: 'tips', label: 'Nice to know' },
]

/** One of your trips: people you know going too, your own plan, and members' tips about the place. */
export function TripMatches() {
  const tripId = Number(useParams().id)
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.some((t) => t.key === params.get('tab')) ? (params.get('tab') as Tab) : 'people'
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined)
  const [companions, setCompanions] = useState<TripCompanion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [today] = useState(() => isoDate(new Date()))
  const [going, setGoing] = useState(0)

  useEffect(() => {
    // Only people you're connected or in touch with (Lewis, 11 Oct): everyone
    // else going at the same time is found on Who’s going.
    Promise.all([getTrip(tripId), tripCompanions(tripId).catch(() => [])]).then(
      ([t, c]) => {
        setTrip(t)
        setCompanions(c)
      },
      (e) => setError(messageOf(e)),
    )
    remember('feed', loadFeed()).then(
      (list) => setGoing(list.filter((p) => p.trips.some((t) => t.mine === tripId)).length),
      () => {},
    )
  }, [tripId])

  useEffect(() => {
    if (trip) heading.current?.focus()
  }, [trip])

  if (error || trip === null) {
    return (
      <Layout>
        <h1>{error ? 'Something went wrong' : 'Trip not found'}</h1>
        <p className="lede">{error ?? 'It may have been deleted.'}</p>
        <Link className="btn btn-secondary" to="/trips">
          Back to my trips
        </Link>
      </Layout>
    )
  }
  if (!trip || !companions) return <Loading />

  const picks = picksFor(trip.city_id)
  return (
    <Layout tab="trips">
      {/* A burgundy banner with the place's letters behind (Claude Design, 15 Oct). */}
      <div className="trip-hero">
        <CityPhoto city={trip.city.name} width={720} credit className="trip-hero-photo" />
        <span className="trip-hero-code" aria-hidden="true">
          {trip.city.name.slice(0, 3).toUpperCase()}
        </span>
        <div className="trip-hero-bar">
          <Link className="trip-hero-btn trip-hero-back" to="/trips" aria-label="Back to your trips">
            <BackIcon />
          </Link>
          <Link className="trip-hero-btn" to={`/trips/${trip.id}/edit`}>
            <Pencil size={18} strokeWidth={2} aria-hidden="true" />
            Edit trip
          </Link>
        </div>
        <div className="trip-hero-text">
          <p className="eyebrow">Your trip</p>
          <h1 ref={heading} tabIndex={-1}>
            {cityLabel(trip.city)}
          </h1>
          <p className="trip-hero-pills">
            <span className="trip-pill">{tripDates(trip.start_date, trip.end_date)}</span>
            {trip.visibility === 'hidden' ? (
              <span className="trip-pill trip-pill-dark">Only you can see this trip</span>
            ) : (
              going > 0 && <span className="trip-pill trip-pill-dark">{going === 1 ? '1 member going' : `${going} members going`}</span>
            )}
          </p>
        </div>
      </div>
      <div className="trip-share">
        <ShareTrip city={trip.city.name} start={trip.start_date} />
      </div>

      <div className="hub-tabs trip-tabs" role="tablist" aria-label="Your trip">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`trip-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="trip-panel"
            className={tab === t.key ? 'hub-tab is-current' : 'hub-tab'}
            onClick={() => setParams(t.key === 'people' ? {} : { tab: t.key }, { replace: true })}
          >
            {t.label}
            {t.key === 'people' && companions.length > 0 && <span className="tab-count"> {companions.length}</span>}
          </button>
        ))}
      </div>

      <div id="trip-panel" role="tabpanel" aria-labelledby={`trip-tab-${tab}`}>
        {tab === 'plan' && <TripPlanner tripId={trip.id} start={trip.start_date} end={trip.end_date} picks={picks} />}
        {tab === 'tips' && <CityTips cityId={trip.city_id} city={trip.city.name} opensOn={trip.start_date > today ? trip.start_date : undefined} />}
        {tab === 'people' && (
          <>
            {companions.length > 0 && (
              <DateOverlap
                city={trip.city.name}
                mine={{ start: trip.start_date, end: trip.end_date }}
                others={companions.map((p) => ({
                  name: p.display_name,
                  start: p.trip_start,
                  end: p.trip_end,
                }))}
              />
            )}

            {companions.length > 0 && (
              <section aria-labelledby="in-touch">
                <h2 id="in-touch" className="section-title">
                  People you know going too
                </h2>
                <ul className="person-list">
                  {companions.map((c) => (
                    <CompanionRow key={c.profile_id} person={c} />
                  ))}
                </ul>
                {companions.some((c) => c.status === 'connected') && (
                  <Link className="btn btn-secondary btn-block" to={`/groups/new?trip=${trip.id}`}>
                    Start a group for this trip
                  </Link>
                )}
              </section>
            )}

            {companions.length === 0 && (
              <EmptyState
                icon={<UsersRound size={18} strokeWidth={2} />}
                title="No connections here yet"
                text={
                  going > 0
                    ? `${going === 1 ? '1 member is' : `${going} members are`} going to ${trip.city.name}. Meet them one at a time on Who’s going. Once you connect, they’ll show here.`
                    : `Meet members going to ${trip.city.name} one at a time on Who’s going. Once you connect, they’ll show here.`
                }
                level={3}
                compact
              >
                <Link className="btn btn-primary btn-block" to={`/connections?trip=${encodeURIComponent(trip.city.name)}`}>
                  See who’s going to {trip.city.name}
                </Link>
              </EmptyState>
            )}
            <OpenGroups cityId={trip.city_id} title={`Groups going to ${trip.city.name}`} />
          </>
        )}
      </div>
    </Layout>
  )
}

const COMPANION_STATUS: Record<TripCompanion['status'], string> = {
  connected: 'Connected',
  group: 'In a group with you',
  you_asked: 'Waiting for their reply',
  they_asked: 'Asked to connect with you',
}

/** Someone on this trip you've already asked, been asked by, or connected with. */
function CompanionRow({ person }: { person: TripCompanion }) {
  const home = homeLabel(person)
  return (
    <li className="card person-card companion-row">
      <Avatar name={person.display_name} path={person.photo_path} size="lg" />
      <div className="companion-who">
        <h3>
          {person.display_name}
          {person.birth_year ? `, ${ageLabel(person.birth_year)}` : ''}
        </h3>
        <p className="profile-meta">{[home, shortDates(person.trip_start, person.trip_end)].filter(Boolean).join(' · ')}</p>
        <p className="companion-status">{COMPANION_STATUS[person.status]}</p>
      </div>
      {person.status === 'they_asked' ? (
        <Link className="btn btn-primary btn-small" to="/requests">
          Answer
        </Link>
      ) : person.status === 'connected' || person.status === 'group' ? (
        <Link className="btn btn-secondary btn-small" to={`/connections/people/${person.profile_id}`}>
          Profile
        </Link>
      ) : null}
    </li>
  )
}
