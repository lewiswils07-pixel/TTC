import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { CardBack } from '../components/CardBack'
import { Layout, Loading } from '../components/Layout'
import { peek, remember } from '../lib/cache'
import { cityLabel } from '../lib/cities'
import { ageFromDate, ageLabel } from '../lib/options'
import { usePhotoUrl } from '../lib/photo'
import { ProfileExtras } from '../components/ProfileExtras'
import { listInterests, type Interest } from '../lib/profile'
import { useSession } from '../lib/session-context'
import { useMyProfile } from '../lib/useMyProfile'

/** "See my card as others do": your suggestion card, front and back, as another member sees it. */
export function CardPreview() {
  const { session } = useSession()
  const { data } = useMyProfile(session!.user.id)
  const [interests, setInterests] = useState<Interest[]>(() => peek('interests') ?? [])
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    remember('interests', listInterests()).then(setInterests, () => undefined)
    heading.current?.focus()
  }, [])
  const photo = usePhotoUrl(data?.profile.photo_path)

  if (!data) return <Loading />
  const { profile, interestIds, card } = data
  const name = profile.display_name ?? ''
  const age = profile.birth_date ? ageFromDate(profile.birth_date) : profile.birth_year ? ageLabel(profile.birth_year) : null
  const mine = interests.filter((i) => interestIds.includes(i.id))

  return (
    <Layout tab="profile">
      <Link className="back-link" to="/profile">
        ‹ Profile
      </Link>
      <h1 ref={heading} tabIndex={-1}>
        How others see you
      </h1>
      <p className="lede">
        This is your card in other members’ suggestions. They also see why we suggest you, such as interests you share or a trip at the same time. Your date of birth, email and exact location are
        never shown.
      </p>
      <article className="card person-feed-card preview-card" aria-label="Your card">
        <div className="feed-photo">
          {photo ? (
            <img src={photo} alt="" />
          ) : (
            <span className="feed-initial" aria-hidden="true">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="feed-who">
            <h2>
              {name}
              {age !== null && <span className="feed-age">, {age}</span>}
            </h2>
            {profile.home_city && <p>{cityLabel(profile.home_city)}</p>}
          </div>
        </div>
        {mine.length > 0 && (
          <div className="shared-interests">
            <h4>Interests</h4>
            <ul className="chip-list">
              {mine.map((i) => (
                <li key={i.id} className="tag">
                  {i.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.more && (
          <ProfileExtras
            name={name}
            extras={{
              photo_book: data.more.photo_book,
              // Others see these with Sodalis+.
              holiday_prefs: data.more.holiday_prefs,
              holiday_locked: false,
              sexuality: data.more.shown_fields.includes('sexuality') ? data.more.sexuality : null,
              religion: data.more.shown_fields.includes('religion') ? data.more.religion : null,
              ethnicity: data.more.shown_fields.includes('ethnicity') ? data.more.ethnicity : null,
            }}
          />
        )}
        {profile.travelling_with && <p className="feed-detail">Travels with: {profile.travelling_with}</p>}
      </article>
      {card && card.card_answers.length > 0 && (
        <section className="card card-back-preview" aria-labelledby="preview-back">
          <h2 id="preview-back" className="card-title">
            When they turn your card over
          </h2>
          <CardBack name={name} answers={card.card_answers} />
        </section>
      )}
      <p className="hint">Once you’re connected, they can also see your bio and how you like to travel.</p>
      <Link className="btn btn-secondary btn-block" to="/onboarding?step=1">
        Edit my profile
      </Link>
    </Layout>
  )
}
