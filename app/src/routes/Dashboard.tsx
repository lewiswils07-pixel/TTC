import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { MyTrips, Wishlist } from '../components/MyTrips'
import { signOut } from '../lib/auth'
import { myConversations } from '../lib/chat'
import { myConnections } from '../lib/connections'
import { cityLabel } from '../lib/cities'
import { BUDGETS, GENDERS, MAX_PREF_AGE, PACES, TRAVEL_STYLES, ageLabel, labelFor } from '../lib/options'
import { photoUrl } from '../lib/photo'
import { listInterests, type Interest } from '../lib/profile'
import { useSession } from '../lib/session-context'
import { useMyProfile } from '../lib/useMyProfile'

export function Dashboard() {
  const { session } = useSession()
  const { data, error, reload } = useMyProfile(session!.user.id)
  const [interests, setInterests] = useState<Interest[]>([])
  const [photo, setPhoto] = useState<string | null>(null)

  useEffect(() => {
    listInterests().then(setInterests, () => undefined)
  }, [])

  useEffect(() => {
    if (data?.profile.photo_path) photoUrl(data.profile.photo_path).then(setPhoto)
  }, [data?.profile.photo_path])

  const signOutButton = (
    <button className="btn-link" onClick={() => signOut()}>
      Sign out
    </button>
  )

  if (error) {
    return (
      <Layout actions={signOutButton}>
        <p className="error" role="alert">
          {error}
        </p>
        <button className="btn btn-primary" onClick={() => reload()}>
          Try again
        </button>
      </Layout>
    )
  }
  if (!data) return <Loading />
  if (!data.profile.onboarded_at) return <Navigate to="/onboarding" replace />

  const { profile, interestIds, preferences } = data
  const travel = [labelFor(TRAVEL_STYLES, profile.travel_style), labelFor(PACES, profile.pace), labelFor(BUDGETS, profile.budget)].filter(
    (l) => l !== 'Not set',
  )
  const myInterests = interests.filter((i) => interestIds.includes(i.id)).map((i) => i.label)

  return (
    <Layout actions={signOutButton}>
      <h1>Hello, {profile.display_name}</h1>
      <Link className="card link-card link-card-primary" to="/people">
        <span className="trip-text">
          <strong>Find people to travel with</strong>
          <span className="trip-meta">For a trip you’ve booked, or to plan something new</span>
        </span>
        <span className="trip-chevron" aria-hidden="true">
          ›
        </span>
      </Link>
      <MessagesLink />
      <ConnectionsLink />
      <MyTrips />
      <Wishlist />
      <section className="card profile-card" aria-labelledby="my-profile">
        <div className="profile-head">
          {photo ? (
            <img className="avatar" src={photo} alt="Your profile photo" />
          ) : (
            <div className="avatar avatar-empty" aria-hidden="true">
              {(profile.display_name ?? '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h2 id="my-profile">{profile.display_name}</h2>
            <p className="profile-meta">
              Age {ageLabel(profile.birth_year)} · {profile.home_city ? cityLabel(profile.home_city) : 'Home not set'}
            </p>
          </div>
        </div>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        <dl className="facts">
          <div>
            <dt>Interests</dt>
            <dd>
              {myInterests.length ? (
                <ul className="chip-list">
                  {myInterests.map((label) => (
                    <li key={label} className="tag">
                      {label}
                    </li>
                  ))}
                </ul>
              ) : (
                'Not set'
              )}
            </dd>
          </div>
          {travel.length > 0 && (
            <div>
              <dt>How I travel</dt>
              <dd>{travel.join(' · ')}</dd>
            </div>
          )}
          <div>
            <dt>Looking for</dt>
            <dd>
              {preferences.genders.map((g) => labelFor(GENDERS, g)).join(', ')}, aged {preferences.age_min} to{' '}
              {preferences.age_max >= MAX_PREF_AGE ? `${MAX_PREF_AGE}+` : preferences.age_max}
            </dd>
          </div>
        </dl>
        <Link className="btn btn-secondary btn-block" to="/onboarding?step=1">
          Edit my profile
        </Link>
      </section>
    </Layout>
  )
}

/** Entry to the Connections page, with a count of requests waiting for an answer. Hidden until the database has connections. */
function ConnectionsLink() {
  const [waiting, setWaiting] = useState<number | null>(null)

  useEffect(() => {
    myConnections().then(
      (list) => setWaiting(list.filter((c) => c.direction === 'received' && c.status === 'pending').length),
      () => setWaiting(null),
    )
  }, [])

  if (waiting === null) return null
  return (
    <Link className="card link-card" to="/connections">
      <span className="trip-text">
        <strong>Connections</strong>
        <span className="trip-meta">{waiting ? `${waiting} ${waiting === 1 ? 'request needs' : 'requests need'} your answer` : 'Your requests and the people you’ve met'}</span>
      </span>
      {waiting > 0 && (
        <span className="badge" aria-hidden="true">
          {waiting}
        </span>
      )}
      <span className="trip-chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  )
}

/** Entry to Messages, with the number of unread messages. Hidden until the database has chat and there's someone to talk to. */
function MessagesLink() {
  const [unread, setUnread] = useState<number | null>(null)

  useEffect(() => {
    myConversations().then(
      (list) => setUnread(list && list.length ? list.reduce((n, c) => n + c.unread, 0) : null),
      () => setUnread(null),
    )
  }, [])

  if (unread === null) return null
  return (
    <Link className="card link-card" to="/messages">
      <span className="trip-text">
        <strong>Messages</strong>
        <span className="trip-meta">{unread ? `${unread} unread ${unread === 1 ? 'message' : 'messages'}` : 'Chat with the people you’re connected with'}</span>
      </span>
      {unread > 0 && (
        <span className="badge" aria-hidden="true">
          {unread}
        </span>
      )}
      <span className="trip-chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  )
}
