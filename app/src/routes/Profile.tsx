import { useEffect, useState, type ReactNode } from 'react'
import { Ban, Camera, Check, Coffee, Eye, Flag, Gem, Lock, Pencil, Settings, Share, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { keep, peek, remember } from '../lib/cache'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Layout, Loading, Monogram } from '../components/Layout'
import { dismissNotice, iAmAdmin, myNotices, type Notice } from '../lib/admin'
import { answerMeet, meetPrompts, type MeetPrompt } from '../lib/meet'
import { Avatar } from '../components/Avatar'
import { BUDGETS, GROUP_SIZES, MAX_PREF_AGE, MOVING, PACES, ROOM_SHARING, TRAVEL_OFTEN, TRAVEL_STYLES, ageFromDate, ageLabel, labelFor } from '../lib/options'
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
import { ErrorState } from '../components/EmptyState'
import { EmergencyNumbers } from '../components/EmergencyNumbers'
import { interestedInText } from '../lib/filters'
import { HolidayChips } from '../components/ProfileExtras'
import { BackIcon, CloseIcon, NextIcon } from '../components/Icons'

type HubTab = 'me' | 'safety' | 'plus'

const ICONS = {
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7.5 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1v-1Zm17.5 1v-1c0-2-.9-3.8-2.4-5.1 3.6.2 6.9 2.2 6.9 5.1v1h-4.5Z',
  filters: 'M3 6h11.2a3 3 0 0 1 5.6 0H21v2h-1.2a3 3 0 0 1-5.6 0H3V6Zm14 1a1 1 0 1 0 0 .01V7ZM3 16h1.2a3 3 0 0 1 5.6 0H21v2H9.8a3 3 0 0 1-5.6 0H3v-2Zm4 1a1 1 0 1 0 0 .01V17Z',
  hand: 'M18 7a1.5 1.5 0 0 0-1.5 1.5V12h-1V4.5a1.5 1.5 0 0 0-3 0V12h-1V3.5a1.5 1.5 0 0 0-3 0V12h-1V6.5a1.5 1.5 0 0 0-3 0V15a7 7 0 0 0 7 7h.5a7 7 0 0 0 6.6-4.7l1.4-4.3V8.5A1.5 1.5 0 0 0 18 7Z',
  share: 'M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1Z',
  phone:
    'M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z',
  shield: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1.2 13.6-3.4-3.4 1.4-1.4 2 2 4.6-4.6 1.4 1.4-6 6Z',
  report: 'M5 21V4h9l.4 2H20v10h-7l-.4-2H7v7H5Z',
  tour: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3.5 6.5-2 5-5 2 2-5 5-2Z',
  star: 'M12 2.5 14.9 8.6l6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.3 1.3-6.5L2.5 9.4l6.6-.8L12 2.5Z',
}

/** The Profile tab as one page: you, what's left to add, how you travel, then account and safety (Claude Design, 15 Oct).
 *  Safety and Sodalis+ open as their own pages from here (?tab=safety, ?tab=plus). */
export function Profile() {
  const { session } = useSession()
  const { data, error, reload } = useMyProfile(session!.user.id)
  const [params] = useSearchParams()
  const tab: HubTab = params.get('tab') === 'safety' || params.get('tab') === 'plus' ? (params.get('tab') as HubTab) : 'me'
  const photo = usePhotoUrl(data?.profile.photo_path)

  if (error) {
    return (
      <Layout tab="profile">
        <ErrorState text={error} onRetry={() => reload()} />
      </Layout>
    )
  }
  if (!data) return <Loading />
  if (!data.profile.onboarded_at) return <Navigate to="/onboarding" replace />

  if (tab === 'plus') {
    return (
      <Layout tab="profile">
        <PlusPanel />
      </Layout>
    )
  }
  if (tab !== 'me') {
    return (
      <Layout tab="profile">
        <Link className="back-link" to="/profile">
          <BackIcon />
          Your profile
        </Link>
        <h1>{tab === 'safety' ? 'Safety' : brand.plusName}</h1>
        {tab === 'safety' ? <SafetyPanel /> : <PlusPanel />}
      </Layout>
    )
  }

  const { profile } = data
  return (
    <Layout tab="profile">
      <h1>Your profile</h1>
      <Notices />
      <section className="card me-card" aria-label="You">
        <div className="me-row">
          <Link className="me-photo" to={stepLink('photo')} aria-label="Change your photo">
            {photo ? (
              <img src={photo} alt="" />
            ) : (
              <span className="me-photo-empty" aria-hidden="true">
                <UserRound size={56} strokeWidth={1.4} />
              </span>
            )}
            <span className="me-camera" aria-hidden="true">
              <Camera size={18} strokeWidth={2} />
            </span>
          </Link>
          <div className="me-who">
            <h2>{profile.display_name}</h2>
            <p>
              {profile.birth_date ? ageFromDate(profile.birth_date) : ageLabel(profile.birth_year)} · {profile.home_city ? profile.home_city.name : 'Home not set'}
            </p>
            {profile.member_number && <p className="me-number">Founding member No. {profile.member_number}</p>}
            {profile.id_verified_at ? (
              <p className="me-id-checked">
                <ShieldCheck size={16} strokeWidth={2} aria-hidden="true" />
                ID checked
              </p>
            ) : (
              <Link className="me-link" to="/verify-id">
                Check your ID
              </Link>
            )}
            <Link className="me-link" to={stepLink('photo')}>
              {profile.photo_path ? 'Change photo' : 'Add a photo'}
            </Link>
          </div>
        </div>
        {profile.headline && <p className="me-headline">“{profile.headline}”</p>}
        {profile.bio && <p className="me-bio">{profile.bio}</p>}
        <Link className="btn btn-secondary btn-block me-preview" to="/profile/preview">
          <Eye size={20} strokeWidth={1.8} aria-hidden="true" />
          See your card as others do
        </Link>
      </section>
      <MyProfilePanel data={data} />
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

/** A card with a serif title and an Edit link on the right. */
function ProfileSection({ id, title, edit, children }: { id: string; title: string; edit?: string; children: ReactNode }) {
  return (
    <section className="card me-section" aria-labelledby={id}>
      <div className="me-section-head">
        <h2 id={id} className="card-title">
          {title}
        </h2>
        {edit && (
          <Link className="me-edit" to={edit} aria-label={`Edit ${title.toLowerCase()}`}>
            <Pencil size={16} strokeWidth={2} aria-hidden="true" />
            Edit
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/** One row in a list card: an icon, the words and a chevron. */
function RowLink({ to, icon, children, danger = false }: { to: string; icon: ReactNode; children: ReactNode; danger?: boolean }) {
  return (
    <li>
      <Link className={danger ? 'row-link is-danger' : 'row-link'} to={to}>
        {icon}
        <span>{children}</span>
        <NextIcon />
      </Link>
    </li>
  )
}

/** Their profile as others see it, plus anything waiting for them. */
function MyProfilePanel({ data }: { data: MyProfile }) {
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
  const myInterests = interests.filter((i) => interestIds.includes(i.id)).map((i) => i.label)
  const style = [
    { label: 'Budget', value: labelFor(BUDGETS, profile.budget) },
    { label: 'Planning', value: labelFor(TRAVEL_STYLES, profile.travel_style) },
    { label: 'Pace', value: labelFor(PACES, profile.pace) },
    { label: 'Moving around', value: labelFor(MOVING, profile.moving) },
    { label: 'How often', value: labelFor(TRAVEL_OFTEN, profile.travel_often) },
    { label: 'Group size', value: labelFor(GROUP_SIZES, profile.group_size) },
    { label: 'Room sharing', value: labelFor(ROOM_SHARING, profile.room_sharing) },
  ].filter((r) => r.value !== 'Not set')
  const icon = { size: 20, strokeWidth: 1.8, 'aria-hidden': true } as const

  return (
    <>
      {hasTrip !== null && <Strength profile={profile} interestCount={interestIds.length} hasTrip={hasTrip} card={data.card} />}
      <MeetPrompts />
      <ProfileSection id="me-interests" title="Interests" edit={stepLink('interests')}>
        {myInterests.length ? (
          <ul className="chip-list">
            {myInterests.map((label) => (
              <li key={label} className="tag">
                {label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">Not added yet.</p>
        )}
      </ProfileSection>
      <ProfileSection id="me-travel" title="How I travel" edit={stepLink('travel')}>
        {style.length ? (
          <dl className="style-rows">
            {style.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="hint">Say how you like to travel, so the right people find you.</p>
        )}
      </ProfileSection>
      {data.more && Object.keys(data.more.holiday_prefs).length > 0 && (
        <ProfileSection id="me-holiday" title="Holiday preferences" edit={stepLink('travel')}>
          <HolidayChips prefs={data.more.holiday_prefs} />
        </ProfileSection>
      )}
      <ProfileSection id="me-companions" title="Travel companions" edit="/filters">
        <p className="me-companions">
          {interestedInText(preferences.genders) === 'Everyone' ? 'Anyone' : interestedInText(preferences.genders)}, aged {preferences.age_min} to{' '}
          {preferences.age_max >= MAX_PREF_AGE ? `${MAX_PREF_AGE}+` : preferences.age_max}
        </p>
        <p className="hint">Who you see on Who’s going. Change it any time in Filters.</p>
      </ProfileSection>
      <Link className="plus-row" to="/profile?tab=plus">
        <span className="plus-row-icon" aria-hidden="true">
          <Gem size={20} strokeWidth={1.8} />
        </span>
        <span className="plus-row-text">
          <strong>{brand.plusName}</strong>
          <span>Filter by travel style, and more</span>
        </span>
        <NextIcon />
      </Link>
      <h2 className="list-label">Your account</h2>
      <ul className="row-list">
        <RowLink to="/filters" icon={<SlidersHorizontal {...icon} />}>
          Filters
        </RowLink>
        <RowLink to="/settings" icon={<Settings {...icon} />}>
          Settings
        </RowLink>
        <RowLink to="/settings/privacy" icon={<Lock {...icon} />}>
          Privacy choices
        </RowLink>
        <RowLink to="/requests#blocked" icon={<Ban {...icon} />}>
          Blocked members
        </RowLink>
      </ul>
      <h2 className="list-label">Safety guides</h2>
      <ul className="row-list">
        <RowLink to="/meeting-safely" icon={<Coffee {...icon} />}>
          Meeting up safely
        </RowLink>
        <RowLink to="/meeting-safely#tell-someone" icon={<Share {...icon} />}>
          Tell someone you trust
        </RowLink>
        <RowLink to="/community-rules" icon={<ShieldCheck {...icon} />}>
          Community rules
        </RowLink>
        <RowLink to="/profile?tab=safety" icon={<Flag {...icon} />} danger>
          Report someone
        </RowLink>
      </ul>
      <ul className="row-list me-tour">
        <RowLink to="/connections?tour=1" icon={<Monogram size={28} />}>
          How the Collective works
        </RowLink>
      </ul>
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
    { title: 'Unlimited connection requests', text: 'Say hello to as many members as you like.' },
    { title: 'Unlimited trip plans', text: 'Plan as many trips together as you want.' },
    { title: 'Travel-style filters', text: 'Find people who travel at your pace and budget.' },
    { title: 'Going when you are', text: 'See the exact days you overlap with other members.' },
    { title: 'Popular groups', text: `See where members are heading, and start up to ${count(rules.groups.maxOwnedPlus, 'group')} at once.` },
    { title: 'Search members’ tips', text: 'Search and filter tips for every place.' },
  ]
  const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="plus-page">
      <div className="plus-hero">
        <Link className="icon-btn plus-close" to="/profile" aria-label="Back to your profile">
          <CloseIcon size={24} />
        </Link>
        <Monogram size={84} />
        <h1>{brand.plusName}</h1>
        <p>More ways to find good company for every trip.</p>
      </div>
      <section className="card plus-offer" aria-label={`Your ${brand.plusName}`}>
        {has ? (
          <>
            <span className="plus-eyebrow">You have {brand.plusName}</span>
            <h2>{until ? `Free until ${date(until)}` : 'Yours, with no end date'}</h2>
            {until && <p className="hint">When the free months end, you move to the free plan on your own. We never ask for a card, so there’s nothing to cancel.</p>}
            <button type="button" className="btn btn-secondary btn-small" onClick={stop}>
              Stop {brand.plusName} now
            </button>
          </>
        ) : (
          <>
            <span className="plus-eyebrow">Coming soon</span>
            <h2>
              {plusPrice()} <span>a month</span>
            </h2>
            <p className="hint">{stopped ? 'You’re on the free plan now. ' : ''}When it starts you can stop it any time in one tap.</p>
          </>
        )}
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
      </section>
      {dialog}
      <h2 className="list-label">What you get</h2>
      <ul className="card plus-perks">
        {perks.map((p) => (
          <li key={p.title}>
            <span className="plus-check" aria-hidden="true">
              <Check size={16} strokeWidth={3} />
            </span>
            <span>
              <strong>{p.title}</strong>
              <span>{p.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="hint center plus-foot">No pressure. The Collective is yours to enjoy for free, whatever you decide.</p>
    </div>
  )
}

/** "Finish your profile": a bar and the full list, ticked as each part is done. Sign-up asks only
 *  the basics, so the rest lives here (testers, 13 Oct). Hidden once it's complete. */
function Strength({ profile, interestCount, hasTrip, card }: { profile: Profile; interestCount: number; hasTrip: boolean; card: Card | null }) {
  const { percent, parts } = profileStrength(profile, interestCount, hasTrip, card)
  const todo = parts.filter((p) => !p.done)
  const done = parts.filter((p) => p.done)
  if (!todo.length) return null
  return (
    <section className="card strength" aria-labelledby="strength-heading">
      <div className="me-section-head">
        <h2 id="strength-heading" className="card-title">
          Finish your profile
        </h2>
        <span className="strength-value">
          {done.length} of {parts.length} done
        </span>
      </div>
      <p className="hint">A fuller profile helps members feel they already know you.</p>
      <div className="strength-bar" role="progressbar" aria-labelledby="strength-heading" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${percent}%` }} />
      </div>
      <ul className="strength-list">
        {todo.map((p) => (
          <li key={p.label}>
            <Link to={p.to}>
              <span className="strength-ring" aria-hidden="true" />
              <span>{p.label}</span>
              <NextIcon />
            </Link>
          </li>
        ))}
        {done.length > 0 && (
          <li className="is-done">
            <span className="strength-tick" aria-hidden="true">
              <Check size={16} strokeWidth={3} />
            </span>
            <span>
              <span className="visually-hidden">Done: </span>
              {done.map((p) => p.label).join(', ')}
            </span>
          </li>
        )}
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
        <NextIcon />
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
