import { useEffect, useState } from 'react'
import { keep, peek, remember } from '../lib/cache'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { dismissNotice, iAmAdmin, myNotices, type Notice } from '../lib/admin'
import { answerMeet, meetPrompts, type MeetPrompt } from '../lib/meet'
import { Avatar } from '../components/Avatar'
import { cityLabel } from '../lib/cities'
import { BUDGETS, MAX_PREF_AGE, MIN_AGE, PACES, ageFromDate, ageLabel, labelFor } from '../lib/options'
import type { Card } from '../lib/card'
import { profileStrength } from '../lib/strength'
import { answerNps, npsDue } from '../lib/kpis'
import { listMyTrips } from '../lib/trips'
import { messageOf } from '../lib/errors'
import { stepLink } from '../lib/onboarding'
import { brand } from '../lib/brand'
import { count, rules } from '../lib/rules'
import { usePhotoUrl } from '../lib/photo'
import { listInterests, type Interest, type MyProfile, type Profile } from '../lib/profile'
import { useSession } from '../lib/session-context'
import { useMyProfile } from '../lib/useMyProfile'
import { plusPrice, plusUntil, stopMyPlus } from '../lib/plan'
import { useConfirm } from '../lib/useConfirm'
import { HubRow } from '../components/HubRow'
import { EmergencyNumbers } from '../components/EmergencyNumbers'
import { interestedInText } from '../lib/filters'
import { HolidayChips } from '../components/ProfileExtras'

type HubTab = 'me' | 'safety' | 'plus'
const HUB_TABS: { key: HubTab; label: string }[] = [
  { key: 'me', label: 'My profile' },
  { key: 'safety', label: 'Safety' },
  { key: 'plus', label: brand.plusName },
]

const ICONS = {
  filters: 'M3 6h11.2a3 3 0 0 1 5.6 0H21v2h-1.2a3 3 0 0 1-5.6 0H3V6Zm14 1a1 1 0 1 0 0 .01V7ZM3 16h1.2a3 3 0 0 1 5.6 0H21v2H9.8a3 3 0 0 1-5.6 0H3v-2Zm4 1a1 1 0 1 0 0 .01V17Z',
  gear: 'M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5-2.3-1.6ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z',
  pencil: 'M4 17.3V20h2.7l8-8-2.7-2.7-8 8Zm12.7-7.4a.7.7 0 0 0 0-1l-1.6-1.6a.7.7 0 0 0-1 0l-1.3 1.3 2.7 2.7 1.2-1.4Z',
  hand: 'M18 7a1.5 1.5 0 0 0-1.5 1.5V12h-1V4.5a1.5 1.5 0 0 0-3 0V12h-1V3.5a1.5 1.5 0 0 0-3 0V12h-1V6.5a1.5 1.5 0 0 0-3 0V15a7 7 0 0 0 7 7h.5a7 7 0 0 0 6.6-4.7l1.4-4.3V8.5A1.5 1.5 0 0 0 18 7Z',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7.5 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1v-1Zm17.5 1v-1c0-2-.9-3.8-2.4-5.1 3.6.2 6.9 2.2 6.9 5.1v1h-4.5Z',
  share: 'M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1Z',
  rules: 'M5 3h11l3 3v15H5V3Zm3 6v2h8V9H8Zm0 4v2h8v-2H8Zm0 4v2h5v-2H8Z',
  phone:
    'M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z',
  shield: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1.2 13.6-3.4-3.4 1.4-1.4 2 2 4.6-4.6 1.4 1.4-6 6Z',
  report: 'M5 21V4h9l.4 2H20v10h-7l-.4-2H7v7H5Z',
  photo: 'M4 5h16v14H4V5Zm2 2v8.6l3.5-3.6 2.5 2.5 3.5-4.5L18 13.5V7H6Zm2.5 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  tour: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3.5 6.5-2 5-5 2 2-5 5-2Z',
  star: 'M12 2.5 14.9 8.6l6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.3 1.3-6.5L2.5 9.4l6.6-.8L12 2.5Z',
}

export function Profile() {
  const { session } = useSession()
  const { data, error, reload } = useMyProfile(session!.user.id)
  const [params, setParams] = useSearchParams()
  const tab: HubTab = HUB_TABS.some((t) => t.key === params.get('tab')) ? (params.get('tab') as HubTab) : 'me'
  const photo = usePhotoUrl(data?.profile.photo_path)

  const actions = (
    <div className="hub-actions">
      <Link className="icon-btn" to="/filters" aria-label="Who I’d like to meet">
        <Icon d={ICONS.filters} />
      </Link>
      <Link className="icon-btn" to="/settings" aria-label="Settings">
        <Icon d={ICONS.gear} />
      </Link>
    </div>
  )

  if (error) {
    return (
      <Layout tab="profile" actions={actions}>
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

  const { profile } = data
  const pick = (key: HubTab) => setParams(key === 'me' ? {} : { tab: key }, { replace: true })

  return (
    <Layout tab="profile" actions={actions}>
      <header className="hub-head">
        <Link className="hub-photo" to={stepLink('photo')} aria-label="Change your photo">
          {photo ? (
            <img src={photo} alt="" />
          ) : (
            <span className="hub-photo-empty" aria-hidden="true">
              {(profile.display_name ?? '?').slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="hub-pencil" aria-hidden="true">
            <Icon d={ICONS.pencil} size={18} />
          </span>
        </Link>
        <h1 className="hub-name">{profile.display_name}</h1>
        <p className="hub-meta">
          {profile.member_number && <span className="hub-number">Founding member No. {profile.member_number}</span>}
          <span>
            {profile.birth_date ? ageFromDate(profile.birth_date) : ageLabel(profile.birth_year)} · {profile.home_city ? cityLabel(profile.home_city) : 'Home not set'}
          </span>
        </p>
      </header>

      <div className="hub-tabs" role="tablist" aria-label="Profile">
        {HUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`hub-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="hub-panel"
            className={tab === t.key ? 'hub-tab is-current' : 'hub-tab'}
            onClick={() => pick(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="hub-panel" role="tabpanel" aria-labelledby={`hub-tab-${tab}`} className="hub-panel">
        {tab === 'me' && <MyProfilePanel data={data} hasPhoto={!!profile.photo_path} />}
        {tab === 'safety' && <SafetyPanel />}
        {tab === 'plus' && <PlusPanel />}
      </div>
    </Layout>
  )
}

function Icon({ d, size = 24 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  )
}

/** Their profile as others see it, plus anything waiting for them. */
function MyProfilePanel({ data, hasPhoto }: { data: MyProfile; hasPhoto: boolean }) {
  const [interests, setInterests] = useState<Interest[]>(() => peek('interests') ?? [])
  const [hasTrip, setHasTrip] = useState<boolean | null>(() => {
    const trips = peek<unknown[] | null>('trips')
    return trips === undefined ? null : !!trips?.length
  })

  useEffect(() => {
    remember('trips', listMyTrips()).then(
      (t) => setHasTrip(!!t?.length),
      () => setHasTrip(false),
    )
  }, [])

  useEffect(() => {
    remember('interests', listInterests()).then(setInterests, () => undefined)
  }, [])

  const { profile, interestIds, preferences } = data
  const travel = [labelFor(PACES, profile.pace), labelFor(BUDGETS, profile.budget)].filter((l) => l !== 'Not set')
  const myInterests = interests.filter((i) => interestIds.includes(i.id)).map((i) => i.label)

  return (
    <>
      <Notices />
      {hasTrip !== null && <Strength profile={profile} interestCount={interestIds.length} hasTrip={hasTrip} card={data.card} />}
      <section className="card profile-card" aria-labelledby="my-profile">
        <h2 id="my-profile" className="card-title">
          About you
        </h2>
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
          {data.more && Object.keys(data.more.holiday_prefs).length > 0 && (
            <div>
              <dt>Holiday preferences</dt>
              <dd>
                <HolidayChips prefs={data.more.holiday_prefs} />
              </dd>
            </div>
          )}
          <div>
            <dt>Looking for</dt>
            <dd>
              {interestedInText(preferences.genders)}, aged {preferences.age_min} to {preferences.age_max >= MAX_PREF_AGE ? `${MAX_PREF_AGE}+` : preferences.age_max}
              {preferences.age_min <= MIN_AGE && preferences.age_max >= MAX_PREF_AGE && (
                <>
                  {' '}
                  <Link to="/filters">Narrow this down</Link>
                </>
              )}
            </dd>
          </div>
        </dl>
        <Link className="btn btn-secondary btn-block" to={stepLink('basics')}>
          Edit my profile
        </Link>
      </section>
      <ul className="hub-list">
        {!hasPhoto && (
          <li>
            <HubRow to={stepLink('photo')} icon={ICONS.photo} title="Add a photo" text="People are far more likely to accept when they can see you." />
          </li>
        )}
        <li>
          <HubRow to="/profile/preview" icon={ICONS.photo} title="See your card as others do" text="Exactly what other members see in their suggestions" />
        </li>
        <li>
          <HubRow to="/connections?tour=1" icon={ICONS.tour} title="How the Collective works" text="A quick tour of what you can do" />
        </li>
      </ul>
      <MeetPrompts />
      <RecommendCard />
      <AdminLink />
    </>
  )
}

/** Safety tools and guides in one place. */
function SafetyPanel() {
  return (
    <>
      <ul className="hub-list">
        <li>
          <HubRow to="/requests#blocked" icon={ICONS.hand} title="Blocked members" text="See or unblock anyone you’ve blocked." />
        </li>
        <li>
          <HubRow to="/meeting-safely" icon={ICONS.share} title="Tell someone you trust" text="Share where and when you’re meeting with a friend." />
        </li>
        <li className="hub-row hub-row-static">
          <span className="hub-icon" aria-hidden="true">
            <Icon d={ICONS.report} />
          </span>
          <span className="hub-text">
            <strong>Report someone</strong>
            <span>Use “Block or report” on their card, or the ⋯ menu in a chat. We read every report.</span>
          </span>
        </li>
        <li>
          <HubRow to="/settings/privacy" icon={ICONS.shield} title="Privacy choices" text="Choose which optional tools we use." />
        </li>
      </ul>

      <h2 className="section-title">Safety guides</h2>
      <div className="guide-grid">
        <Link className="guide-card" to="/meeting-safely">
          <strong>Meeting up safely</strong>
          <span>How to plan a first meet-up and travel together with confidence.</span>
        </Link>
        <Link className="guide-card" to="/community-rules">
          <strong>Community rules</strong>
          <span>How we look after each other in the Collective.</span>
        </Link>
      </div>

      <section className="card emergency-card" aria-labelledby="emergency-title">
        <span className="hub-icon" aria-hidden="true">
          <Icon d={ICONS.phone} />
        </span>
        <div>
          <h2 id="emergency-title">If you need help now</h2>
          <EmergencyNumbers />
        </div>
      </section>
    </>
  )
}

/** What Sodalis+ lets them do, and how long they have it. */
function PlusPanel() {
  const [until, setUntil] = useState<string | null | undefined | 'loading'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [stopped, setStopped] = useState(false)
  const { ask, dialog } = useConfirm()
  useEffect(() => {
    plusUntil().then(setUntil, () => setUntil(undefined))
  }, [])

  async function stop() {
    const yes = await ask({
      title: `Stop ${brand.plusName} now?`,
      message: 'You’ll move to the free plan straight away. Your connections, chats and trips all stay.',
      confirmLabel: `Stop ${brand.plusName}`,
      cancelLabel: `Keep ${brand.plusName}`,
    })
    if (!yes) return
    setError(null)
    try {
      await stopMyPlus()
      setUntil(undefined)
      setStopped(true)
    } catch (e) {
      setError(messageOf(e))
    }
  }
  if (until === 'loading') return <div className="skeleton-block" aria-hidden="true" />
  const has = until !== undefined
  const perks = [
    { icon: ICONS.people, title: 'Connect with as many people as you like' },
    { icon: ICONS.tour, title: 'See everyone’s holiday preferences' },
    { icon: ICONS.filters, title: 'Filter by pace and budget' },
    { icon: ICONS.star, title: `Start up to ${count(rules.groups.maxOwnedPlus, 'group')} at once` },
  ]
  return (
    <>
      <section className="card plus-card" aria-labelledby="plus-title">
        <span className="tag tag-plus">{brand.plusName}</span>
        <h2 id="plus-title">{has ? `You have ${brand.plusName}` : `Do more with ${brand.plusName}`}</h2>
        <p className="plus-price">
          <strong>{plusPrice()}</strong> a month
        </p>
        {has ? (
          <>
            <p>{until ? `It’s free for you until ${new Date(until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.` : 'It’s yours with no end date.'}</p>
            {until && (
              <p className="hint">
                When the free months end, you move to the free plan on your own. We never ask for a card for them, so there’s nothing to cancel and you’ll never be charged without saying yes first.
              </p>
            )}
            <button type="button" className="btn btn-secondary btn-small" onClick={stop}>
              Stop {brand.plusName} now
            </button>
          </>
        ) : (
          <p>
            {stopped ? `You’re on the free plan now. ` : ''}
            {brand.plusName} is coming soon. When it starts you can stop it any time in one tap.
          </p>
        )}
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
      </section>
      {dialog}
      <ul className="hub-list">
        {perks.map((p) => (
          <li key={p.title} className="hub-row hub-row-static">
            <span className="hub-icon" aria-hidden="true">
              <Icon d={p.icon} />
            </span>
            <span className="hub-text">
              <strong>{p.title}</strong>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

/** A bar showing how complete the profile is, with the next thing to add. Hidden once it's complete. */
function Strength({ profile, interestCount, hasTrip, card }: { profile: Profile; interestCount: number; hasTrip: boolean; card: Card | null }) {
  const { percent, parts } = profileStrength(profile, interestCount, hasTrip, card)
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
      <p className="hint">Complete profiles get more suggestions, and more people accept their requests. Next:</p>
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
  warning: { title: `A note from the ${brand.shortName} team`, text: 'Please keep to our community rules so everyone feels safe.' },
  suspended: {
    title: 'Your account is paused',
    text: 'While it’s paused, other members can’t see you, and you can’t send requests or messages. We’ll be in touch by email.',
  },
  removed: { title: 'Your account has been closed', text: 'It was closed for breaking our community rules. If you think this is a mistake, reply to any email from us.' },
  reinstated: { title: 'Welcome back', text: 'Your account is active again.' },
}

/** Warnings and account changes from the team. Warnings and "welcome back" can be closed; a pause shows while it lasts. */
function Notices() {
  const [notices, setNotices] = useState<Notice[]>(() => peek('notices') ?? [])

  useEffect(() => {
    remember('notices', myNotices()).then(setNotices)
  }, [])

  async function close(id: number) {
    setNotices((list) => {
      const left = list.filter((n) => n.id !== id)
      keep('notices', left)
      return left
    })
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
  const [admin, setAdmin] = useState(() => peek<boolean>('admin') ?? false)
  useEffect(() => {
    remember('admin', iAmAdmin()).then(setAdmin)
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
  const [prompts, setPrompts] = useState<MeetPrompt[]>(() => peek('meetPrompts') ?? [])
  const [step, setStep] = useState<'met' | 'again' | 'thanks'>('met')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    remember('meetPrompts', meetPrompts()).then(setPrompts)
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
    setPrompts((list) => {
      const left = list.slice(1)
      keep('meetPrompts', left)
      return left
    })
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
          <p>Your answer is saved. If anything went wrong on the trip, you can report {p.display_name} from your chat with them.</p>
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

function npsSnoozed(): boolean {
  try {
    return Date.now() < Number(localStorage.getItem('sodalis.npsSnooze') ?? 0)
  } catch {
    // Private browsing: ask anyway.
    return false
  }
}

/** "How likely are you to recommend us?" after 2 weeks, then every 90 days. "Not now" waits a week on this phone. */
function RecommendCard() {
  const [due, setDue] = useState(() => !npsSnoozed() && (peek<boolean>('npsDue') ?? false))
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [state, setState] = useState<'ask' | 'busy' | 'thanks'>('ask')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!npsSnoozed()) remember('npsDue', npsDue()).then(setDue)
  }, [])

  if (!due) return null

  function later() {
    try {
      localStorage.setItem('sodalis.npsSnooze', String(Date.now() + 7 * 86_400_000))
    } catch {
      // Nothing to save.
    }
    keep('npsDue', false)
    setDue(false)
  }

  async function send() {
    if (score === null) return
    setState('busy')
    setError(null)
    try {
      await answerNps(score, comment)
      keep('npsDue', false)
      setState('thanks')
    } catch (e) {
      setError(messageOf(e))
      setState('ask')
    }
  }

  return (
    <section className="card recommend-card" aria-labelledby="recommend-title">
      <h2 id="recommend-title">{state === 'thanks' ? 'Thank you' : 'How likely are you to recommend the Collective to a friend?'}</h2>
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
              <textarea className="textarea textarea-short" maxLength={rules.survey.commentMax} value={comment} onChange={(e) => setComment(e.target.value)} />
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
