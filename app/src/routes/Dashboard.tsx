import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { signOut } from '../lib/auth'
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
      <div className="notice">
        <strong>Your profile is ready.</strong> Adding trips and finding people to travel with are coming next.
      </div>
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
