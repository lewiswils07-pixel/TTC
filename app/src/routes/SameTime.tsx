import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Layout } from '../components/Layout'
import { goingWhenYouAre } from '../components/SameTimeStrip'
import { SkeletonRows } from '../components/Skeleton'
import { brand } from '../lib/brand'
import { shortDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { loadFeed, sameTime, type FeedPerson } from '../lib/feed'
import { ageLabel } from '../lib/options'
import { hasPlus, plusPrice } from '../lib/plan'

/** Sodalis+: everyone going to the same place as you, at the same time, on a page of its own colour. */
export function SameTime() {
  const heading = useRef<HTMLHeadingElement>(null)
  const [plus, setPlus] = useState<boolean | null>(null)
  const [people, setPeople] = useState<FeedPerson[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    heading.current?.focus()
    hasPlus().then((p) => {
      setPlus(p)
      if (p) loadFeed().then((list) => setPeople(goingWhenYouAre(list)), (e) => setError(messageOf(e)))
    })
  }, [])

  return (
    <Layout tab="connections">
      <div className="plus-page">
        <Link className="back-link" to="/connections">
          ‹ Connect
        </Link>
        <span className="tag tag-plus">{brand.plusName}</span>
        <h1 ref={heading} tabIndex={-1}>
          Going when you are
        </h1>
        {plus === false ? (
          <div className="plus-offer">
            <p className="lede">See every member going to the same place as you, at the same time, so you can plan to meet up while you’re both there.</p>
            <p className="plus-offer-price">
              Comes with {brand.plusName}, <strong>{plusPrice()}</strong> a month. You can stop at any time.
            </p>
            <Link className="btn btn-primary btn-lg" to="/profile?tab=plus">
              Get {brand.plusName}
            </Link>
            <Link className="btn btn-secondary btn-lg" to="/connections">
              Not now
            </Link>
          </div>
        ) : (
          <>
            <p className="lede">Members going to the same place as you, at the same time.</p>
            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}
            {!people && !error && <SkeletonRows rows={3} label="Finding who’s going when you are…" />}
            {people && people.length === 0 && <p className="hint">No one yet. We’ll show members here as soon as someone books the same place and dates as you.</p>}
            {people && people.length > 0 && (
              <ul className="plus-people">
                {people.map((p) => {
                  const trip = sameTime(p)!
                  return (
                    <li key={p.profile_id}>
                      <Link className="card plus-person" to={`/trips/${p.trip_id}`}>
                        <Avatar name={p.display_name} path={p.photo_path} size="lg" />
                        <span className="plus-person-text">
                          <strong>{p.display_name}</strong>
                          <span>{[p.birth_year ? `Age ${ageLabel(p.birth_year)}` : null, p.home_city].filter(Boolean).join(' · ')}</span>
                          <span className="plus-person-trip">
                            {trip.city}, {shortDates(trip.start, trip.end)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
