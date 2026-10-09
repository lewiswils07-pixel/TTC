import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CardBack } from '../components/CardBack'
import { Layout, Loading } from '../components/Layout'
import { SafetyBox } from '../components/SafetyBox'
import { myConversations } from '../lib/chat'
import { messageOf } from '../lib/errors'
import { homeLabel } from '../lib/matching'
import { loadMemberProfile, type MemberProfile as Member } from '../lib/member'
import { BUDGETS, DAY_RHYTHMS, DIETS, LANGUAGES, PACES, ROOM_SHARING, TRAVEL_STYLES, WALKING, ageLabel, labelFor } from '../lib/options'
import { photoUrl } from '../lib/photo'
import { useSession } from '../lib/session-context'
import { useMyProfile } from '../lib/useMyProfile'

/** A connection's full profile: photo, interests, how they travel and the back of their card. */
export function MemberProfile() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useSession()
  const mine = useMyProfile(session!.user.id).data
  const [member, setMember] = useState<Member | null | undefined>(undefined)
  const [chatId, setChatId] = useState<number | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1

  useEffect(() => {
    loadMemberProfile(id).then(
      (m) => {
        setMember(m)
        if (m?.photo_path) photoUrl(m.photo_path).then(setPhoto, () => undefined)
      },
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
      ‹ Back
    </button>
  ) : (
    <Link className="back-link" to="/messages">
      ‹ Chats
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
  const travel = [
    ['Plans', labelFor(TRAVEL_STYLES, member.travel_style)],
    ['Pace', labelFor(PACES, member.pace)],
    ['Budget', labelFor(BUDGETS, member.budget)],
    ['Rooms', labelFor(ROOM_SHARING, member.room_sharing)],
    ['Mornings', labelFor(DAY_RHYTHMS, member.day_rhythm)],
    ['Walking', labelFor(WALKING, member.walking)],
  ].filter(([, v]) => v !== 'Not set')
  const languages = member.languages.map((code) => LANGUAGES.find((l) => l.value === code)?.label ?? code)
  const diet = member.diet.map((d) => labelFor(DIETS, d))

  return (
    <Layout tab="connections">
      {back}
      <article className="member-page" aria-labelledby="member-name">
        <div className="member-hero">
          {photo ? (
            <img src={photo} alt="" />
          ) : (
            <span className="feed-initial" aria-hidden="true">
              {member.display_name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="feed-who">
            <h1 id="member-name" ref={heading} tabIndex={-1}>
              {member.display_name}
              {member.birth_year ? <span className="feed-age">, {ageLabel(member.birth_year)}</span> : null}
            </h1>
            {home && <p>{home}</p>}
          </div>
        </div>

        <div className="member-actions">
          {chatId && (
            <Link className="btn btn-primary" to={`/messages/${chatId}`}>
              Message
            </Link>
          )}
          {chatId && (
            <Link className="btn btn-secondary" to={`/plan-together/${member.profile_id}`}>
              Plan a trip together
            </Link>
          )}
        </div>

        {member.bio && (
          <section className="card" aria-labelledby="member-about">
            <h2 id="member-about" className="card-title">
              About {member.display_name}
            </h2>
            <p className="profile-bio">{member.bio}</p>
          </section>
        )}

        <section className="card member-card-back" aria-labelledby="member-card">
          <h2 id="member-card" className="card-title">
            In their own words
          </h2>
          <CardBack name={member.display_name} answers={member.card_answers} />
        </section>

        {member.interests.length > 0 && (
          <section className="card" aria-labelledby="member-interests">
            <h2 id="member-interests" className="card-title">
              Interests
            </h2>
            {shared > 0 && <p className="hint section-hint">{shared === 1 ? 'You share 1 of these.' : `You share ${shared} of these.`}</p>}
            <ul className="chip-list">
              {member.interests.map((i) => (
                <li key={i.id} className={myIds.has(i.id) ? 'tag tag-shared' : 'tag'}>
                  {i.label}
                  {myIds.has(i.id) && <span className="visually-hidden"> (you share this)</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(travel.length > 0 || languages.length > 0 || diet.length > 0 || member.travelling_with) && (
          <section className="card" aria-labelledby="member-travel">
            <h2 id="member-travel" className="card-title">
              How {member.display_name} travels
            </h2>
            <dl className="facts member-facts">
              {travel.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              {languages.length > 0 && (
                <div>
                  <dt>Speaks</dt>
                  <dd>{languages.join(', ')}</dd>
                </div>
              )}
              {diet.length > 0 && (
                <div>
                  <dt>Food</dt>
                  <dd>{diet.join(', ')}</dd>
                </div>
              )}
              {member.travelling_with && (
                <div>
                  <dt>Travels with</dt>
                  <dd>{member.travelling_with}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {member.connected_at && (
          <p className="hint member-since">
            Connected since {new Date(member.connected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
        <SafetyBox profileId={member.profile_id} name={member.display_name} onBlocked={(message) => navigate('/messages', { state: { message } })} />
      </article>
    </Layout>
  )
}
