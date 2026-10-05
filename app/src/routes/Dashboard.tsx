import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { MyTrips, Wishlist } from '../components/MyTrips'
import { dismissNotice, iAmAdmin, myNotices, type Notice } from '../lib/admin'
import { signOut } from '../lib/auth'
import { answerMeet, meetPrompts, type MeetPrompt } from '../lib/meet'
import { Avatar } from '../components/Avatar'
import { myConversations } from '../lib/chat'
import { myConnections } from '../lib/connections'
import { cityLabel } from '../lib/cities'
import { BUDGETS, GENDERS, MAX_PREF_AGE, PACES, TRAVEL_STYLES, ageLabel, labelFor } from '../lib/options'
import { messageOf } from '../lib/errors'
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
      <Notices />
      <MeetPrompts />
      <AdminLink />
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

const NOTICE_TEXT: Record<Notice['kind'], { title: string; text: string }> = {
  warning: { title: 'A note from the Sodalis team', text: 'Please keep to our community rules so everyone feels safe.' },
  suspended: {
    title: 'Your account is paused',
    text: 'While it’s paused, other members can’t see you, and you can’t send requests or messages. We’ll be in touch by email.',
  },
  removed: { title: 'Your account has been closed', text: 'It was closed for breaking our community rules. If you think this is a mistake, reply to any email from us.' },
  reinstated: { title: 'Welcome back', text: 'Your account is active again.' },
}

/** Warnings and account changes from the team. Warnings and "welcome back" can be closed; a pause shows while it lasts. */
function Notices() {
  const [notices, setNotices] = useState<Notice[]>([])

  useEffect(() => {
    myNotices().then(setNotices)
  }, [])

  async function close(id: number) {
    setNotices((list) => list.filter((n) => n.id !== id))
    await dismissNotice(id).catch(() => undefined)
  }

  return notices.map((n) => {
    const { title, text } = NOTICE_TEXT[n.kind]
    const closable = n.kind === 'warning' || n.kind === 'reinstated'
    return (
      <section key={n.id} className={`card member-notice member-notice-${n.kind}`} role={closable ? undefined : 'alert'} aria-label={title}>
        <h2>{title}</h2>
        {n.body && <p className="member-notice-body">“{n.body}”</p>}
        <p>{text}</p>
        {closable && (
          <button type="button" className="btn btn-secondary btn-small" onClick={() => close(n.id)}>
            Got it
          </button>
        )}
      </section>
    )
  })
}

/** Link to the review page, for admins only. */
function AdminLink() {
  const [admin, setAdmin] = useState(false)
  useEffect(() => {
    iAmAdmin().then(setAdmin)
  }, [])
  if (!admin) return null
  return (
    <Link className="card link-card" to="/admin">
      <span className="trip-text">
        <strong>Review reports</strong>
        <span className="trip-meta">Reports and flagged messages (team only)</span>
      </span>
      <span className="trip-chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  )
}

/** "Did you meet?" after a trip a connection was about, one person at a time. */
function MeetPrompts() {
  const [prompts, setPrompts] = useState<MeetPrompt[]>([])
  const [step, setStep] = useState<'met' | 'again' | 'thanks'>('met')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    meetPrompts().then(setPrompts)
  }, [])

  const p = prompts[0]
  if (!p) return null

  async function answer(met: boolean, again: boolean | null = null) {
    setError(null)
    try {
      await answerMeet(p.connection_id, met, again)
      setStep('thanks')
    } catch (e) {
      setError(messageOf(e))
    }
  }

  function next() {
    setPrompts((list) => list.slice(1))
    setStep('met')
  }

  return (
    <section className="card meet-card" aria-labelledby="meet-title">
      <div className="match-head">
        <Avatar name={p.display_name} path={p.photo_path} size="sm" />
        <h2 id="meet-title">{step === 'thanks' ? 'Thank you' : step === 'met' ? `Did you meet ${p.display_name} in ${p.trip_city}?` : `Would you travel with ${p.display_name} again?`}</h2>
      </div>
      {step === 'met' && (
        <>
          <p className="hint">Only our team sees your answer. It helps us suggest good companions.</p>
          <div className="action-row">
            <button type="button" className="btn btn-secondary" onClick={() => answer(false)}>
              No
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setStep('again')}>
              Yes, we met
            </button>
          </div>
        </>
      )}
      {step === 'again' && (
        <div className="meet-choices">
          <button type="button" className="btn btn-primary" onClick={() => answer(true, true)}>
            Yes
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => answer(true, null)}>
            Not sure
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => answer(true, false)}>
            No
          </button>
        </div>
      )}
      {step === 'thanks' && (
        <>
          <p>Your answer is saved. If anything went wrong on the trip, you can report {p.display_name} from your Connections page.</p>
          <button type="button" className="btn btn-secondary btn-small" onClick={next}>
            Done
          </button>
        </>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
