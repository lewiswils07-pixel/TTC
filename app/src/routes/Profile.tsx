import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { dismissNotice, iAmAdmin, myNotices, type Notice } from '../lib/admin'
import { signOut } from '../lib/auth'
import { answerMeet, meetPrompts, type MeetPrompt } from '../lib/meet'
import { Avatar } from '../components/Avatar'
import { cityLabel } from '../lib/cities'
import { BUDGETS, GENDERS, MAX_PREF_AGE, PACES, TRAVEL_STYLES, ageFromDate, ageLabel, labelFor } from '../lib/options'
import { profileStrength } from '../lib/strength'
import { answerNps, npsDue } from '../lib/kpis'
import { listMyTrips } from '../lib/trips'
import { messageOf } from '../lib/errors'
import { photoUrl } from '../lib/photo'
import { listInterests, type Interest, type Profile } from '../lib/profile'
import { useSession } from '../lib/session-context'
import { useMyProfile } from '../lib/useMyProfile'

export function Profile() {
  const { session } = useSession()
  const { data, error, reload } = useMyProfile(session!.user.id)
  const [interests, setInterests] = useState<Interest[]>([])
  const [photo, setPhoto] = useState<string | null>(null)
  const [hasTrip, setHasTrip] = useState<boolean | null>(null)

  useEffect(() => {
    listMyTrips().then((t) => setHasTrip(!!t?.length), () => setHasTrip(false))
  }, [])

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
      <Layout tab="profile" actions={signOutButton}>
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
    <Layout tab="profile">
      <h1 className="gold-rule">Hello, {profile.display_name}</h1>
      {profile.member_number && <p className="founding-badge">Founding member No. {profile.member_number}</p>}
      <Notices />
      {hasTrip !== null && <Strength profile={profile} interestCount={interestIds.length} hasTrip={hasTrip} />}
      <MeetPrompts />
      <RecommendCard />
      <AdminLink />
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
              Age {profile.birth_date ? ageFromDate(profile.birth_date) : ageLabel(profile.birth_year)} · {profile.home_city ? cityLabel(profile.home_city) : 'Home not set'}
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
      <nav className="card settings-list" aria-label="Settings">
        <Link to="/filters">Who I’d like to meet</Link>
        <Link to="/meeting-safely">Meeting up safely</Link>
        <Link to="/community-rules">Community rules</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <button type="button" className="btn-link" onClick={() => signOut()}>
          Sign out
        </button>
      </nav>
    </Layout>
  )
}

/** A bar showing how complete the profile is, with the next thing to add. Hidden once it's complete. */
function Strength({ profile, interestCount, hasTrip }: { profile: Profile; interestCount: number; hasTrip: boolean }) {
  const { percent, parts } = profileStrength(profile, interestCount, hasTrip)
  const next = parts.filter((p) => !p.done)
  if (!next.length) return null
  return (
    <section className="card strength" aria-labelledby="strength-heading">
      <div className="strength-head">
        <h2 id="strength-heading">Profile strength</h2>
        <span className="strength-value">{percent}%</span>
      </div>
      <div className="strength-bar" role="progressbar" aria-labelledby="strength-heading" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${percent}%` }} />
      </div>
      <p className="hint">Complete profiles get more suggestions and more yeses. Next:</p>
      <ul className="strength-next">
        {next.slice(0, 2).map((p) => (
          <li key={p.label}>
            <Link to={p.to}>{p.label}</Link>
          </li>
        ))}
      </ul>
    </section>
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
        <strong>Team: reports and insights</strong>
        <span className="trip-meta">Reports, flagged messages and KPIs (team only)</span>
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


/** "How likely are you to recommend us?" after 2 weeks, then every 90 days. "Not now" waits a week on this phone. */
function RecommendCard() {
  const [due, setDue] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [state, setState] = useState<'ask' | 'busy' | 'thanks'>('ask')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let snoozed = false
    try {
      snoozed = Date.now() < Number(localStorage.getItem('sodalis.npsSnooze') ?? 0)
    } catch {
      // Private browsing: ask anyway.
    }
    if (!snoozed) npsDue().then(setDue)
  }, [])

  if (!due) return null

  function later() {
    try {
      localStorage.setItem('sodalis.npsSnooze', String(Date.now() + 7 * 86_400_000))
    } catch {
      // Nothing to save.
    }
    setDue(false)
  }

  async function send() {
    if (score === null) return
    setState('busy')
    setError(null)
    try {
      await answerNps(score, comment)
      setState('thanks')
    } catch (e) {
      setError(messageOf(e))
      setState('ask')
    }
  }

  return (
    <section className="card recommend-card" aria-labelledby="recommend-title">
      <h2 id="recommend-title">{state === 'thanks' ? 'Thank you' : 'How likely are you to recommend Sodalis to a friend?'}</h2>
      {state === 'thanks' ? (
        <p>Your answer helps us make the Collective better.</p>
      ) : (
        <>
          <div className="score-row" role="radiogroup" aria-label="0 is not at all likely, 10 is extremely likely">
            {Array.from({ length: 11 }, (_, n) => (
              <button key={n} type="button" role="radio" aria-checked={score === n} className={score === n ? 'score is-chosen' : 'score'} onClick={() => setScore(n)}>
                {n}
              </button>
            ))}
          </div>
          <div className="score-ends" aria-hidden="true">
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
          {score !== null && (
            <label className="field">
              <span>Anything you’d like to tell us? (optional)</span>
              <textarea className="textarea textarea-short" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
          )}
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <div className="action-row">
            <button type="button" className="btn btn-secondary" onClick={later}>
              Not now
            </button>
            <button type="button" className="btn btn-primary" disabled={score === null || state === 'busy'} onClick={send}>
              Send
            </button>
          </div>
        </>
      )}
    </section>
  )
}
