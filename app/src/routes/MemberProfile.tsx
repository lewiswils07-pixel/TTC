import { IdTick } from '../components/IdTick'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CardBack } from '../components/CardBack'
import { Layout, Loading } from '../components/Layout'
import { SafetyMenu } from '../components/SafetyBox'
import { usePhotoUrl } from '../lib/photo'
import { MessageCircle, UsersRound } from 'lucide-react'
import { ProfileExtras } from '../components/ProfileExtras'
import { myConversations } from '../lib/chat'
import { messageOf } from '../lib/errors'
import { homeLabel } from '../lib/matching'
import { loadExtras, loadMemberProfile, type MemberExtras, type MemberProfile as Member } from '../lib/member'
import { DIETS, STYLE_QUESTIONS, ageLabel, labelFor } from '../lib/options'
import { useSession } from '../lib/session-context'
import { useMyProfile } from '../lib/useMyProfile'
import { BackIcon } from '../components/Icons'

/** A connection's full profile: how they travel and what they love first, a small photo, then their own words (Lewis, 12 Oct). */
export function MemberProfile() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useSession()
  const mine = useMyProfile(session!.user.id).data
  const [member, setMember] = useState<Member | null | undefined>(undefined)
  const [chatId, setChatId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [extras, setExtras] = useState<MemberExtras | null>(null)
  useEffect(() => {
    loadExtras(id).then(setExtras)
  }, [id])
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1

  useEffect(() => {
    loadMemberProfile(id).then(
      (m) => setMember(m),
      (e) => setError(messageOf(e)),
    )
    myConversations().then(
      (list) => setChatId((list ?? []).find((c) => c.kind === 'direct' && c.profile_id === id)?.id ?? null),
      () => undefined,
    )
  }, [id])
  useEffect(() => {
    if (member) heading.current?.focus()
  }, [member])

  const back = canGoBack ? (
    <button type="button" className="back-link btn-plain" onClick={() => navigate(-1)}>
      <BackIcon />
      Back
    </button>
  ) : (
    <Link className="back-link" to="/messages">
      <BackIcon />
      Chats
    </Link>
  )

  if (error) {
    return (
      <Layout tab="connections">
        {back}
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      </Layout>
    )
  }
  if (member === undefined) return <Loading />
  if (member === null) {
    return (
      <Layout tab="connections">
        {back}
        <h1>Profile not available</h1>
        <p className="lede">You can see someone’s full profile once you’re connected or in the same group.</p>
        <Link className="btn btn-primary" to="/messages">
          Go to Chats
        </Link>
      </Layout>
    )
  }

  const home = homeLabel(member)
  const myIds = new Set(mine?.interestIds ?? [])
  const shared = member.interests.filter((i) => myIds.has(i.id)).length
  const answers: Record<string, string | null | undefined> = {
    pace: member.pace,
    budget: member.budget,
    travel_style: member.travel_style,
    moving: extras?.moving,
    travel_often: extras?.travel_often,
    booking: extras?.booking,
    group_size: extras?.group_size,
  }
  const travel = STYLE_QUESTIONS.map((q) => [q.label, labelFor(q.options, answers[q.key] ?? null)]).filter(([, v]) => v !== 'Not set')
  const diet = member.diet.map((d) => labelFor(DIETS, d))

  const blocked = (message: string) => navigate('/messages', { state: { message } })

  return (
    <Layout tab="connections">
      <article className="member-page person-page" aria-labelledby="member-name">
        <div className="person-top">
          {back}
          <SafetyMenu profileId={member.profile_id} name={member.display_name} onBlocked={blocked} />
        </div>
        <div className="member-intro">
          <MemberPhoto name={member.display_name} path={member.photo_path} />
          <h1 id="member-name" ref={heading} tabIndex={-1}>
            {member.display_name}
            {member.birth_year ? `, ${ageLabel(member.birth_year)}` : ''}
          </h1>
          <IdTick id={member.profile_id} />
          {home && <p>{home}</p>}
          {extras?.headline && <p className="going-headline is-page">“{extras.headline}”</p>}
          {member.connected_at && (
            <span className="going-badge is-gold">Connected since {new Date(member.connected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          )}
        </div>
        {member.travelling_with && (
          <p className="tip-box">
            <UsersRound size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>Travels with: {member.travelling_with}</span>
          </p>
        )}

        {member.interests.length > 0 && (
          <section className="card person-section" aria-labelledby="member-interests">
            <h2 id="member-interests">Interests</h2>
            <ul className="chip-list">
              {member.interests.map((i) => (
                <li key={i.id} className={myIds.has(i.id) ? 'tag tag-place is-shared tag-plain' : 'tag'}>
                  {i.label}
                  {myIds.has(i.id) && <span className="visually-hidden"> (you share this)</span>}
                </li>
              ))}
            </ul>
            {shared > 0 && <p className="hint">Gold ones you share</p>}
          </section>
        )}

        {(travel.length > 0 || diet.length > 0) && (
          <section className="card person-section" aria-labelledby="member-travel">
            <h2 id="member-travel">How {member.display_name} travels</h2>
            <dl className="style-rows">
              {travel.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              {diet.length > 0 && (
                <div>
                  <dt>Food</dt>
                  <dd>{diet.join(', ')}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {member.bio && (
          <section className="card person-section" aria-labelledby="member-about">
            <h2 id="member-about">About {member.display_name}</h2>
            <p className="profile-bio">{member.bio}</p>
          </section>
        )}

        <section className="card person-section going-words" aria-labelledby="member-card">
          <h2 id="member-card">In their own words</h2>
          <CardBack name={member.display_name} answers={member.card_answers} />
        </section>

        {extras && (extras.photo_book.length > 0 || extras.holiday_prefs || extras.holiday_locked || extras.sexuality || extras.religion || extras.ethnicity) && (
          <section className="card person-section member-extras" aria-label={`More about ${member.display_name}`}>
            <ProfileExtras extras={extras} name={member.display_name} headingLevel={3} />
          </section>
        )}

        {chatId && (
          <div className="person-actions is-page member-actions">
            <Link className="btn btn-primary btn-block" to={`/messages/${chatId}`}>
              <MessageCircle size={20} strokeWidth={2} aria-hidden="true" />
              Message {member.display_name}
            </Link>
            <Link className="btn-link member-plan" to={`/plan-together/${member.profile_id}`}>
              Plan a trip together
            </Link>
          </div>
        )}
      </article>
    </Layout>
  )
}

/** Their photo, large and rounded, or a soft colour with their initial. */
function MemberPhoto({ name, path }: { name: string; path: string | null }) {
  const src = usePhotoUrl(path)
  return (
    <div className={src ? 'going-photo member-photo' : 'going-photo member-photo is-empty'} style={src ? undefined : { ['--hue' as string]: (name.charCodeAt(0) * 47) % 360 }}>
      {src ? (
        <img src={src} alt="" />
      ) : (
        <span className="going-initial" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  )
}
