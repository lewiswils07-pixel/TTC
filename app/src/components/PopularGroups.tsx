import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { brand } from '../lib/brand'
import { peek, remember } from '../lib/cache'
import { hasPlus } from '../lib/plan'
import { popularDestinations, type PopularPlace } from '../lib/trips'

/** Sodalis+ on Groups: places members are heading right now, each a tap away from starting a trip group there (Lewis, 11 Oct). */
export function PopularGroups({ canStart }: { canStart: boolean }) {
  const [plus, setPlus] = useState<boolean | null>(null)
  const [places, setPlaces] = useState<PopularPlace[] | undefined>(() => peek('popular'))

  useEffect(() => {
    hasPlus().then(setPlus, () => setPlus(false))
    remember('popular', popularDestinations()).then(setPlaces, () => setPlaces([]))
  }, [])

  if (plus === null || !places?.length) return null
  return (
    <section className="popular-groups" aria-labelledby="popular-groups-title">
      <div className="plus-head">
        <h2 className="section-title" id="popular-groups-title">
          Popular right now
        </h2>
        <span className="tag tag-plus">{brand.plusName}</span>
      </div>
      {!plus ? (
        <p className="hint">
          See where members are heading now and start a group for it. <Link to="/profile?tab=plus">Comes with {brand.plusName}</Link>
        </p>
      ) : (
        <ul className="person-list">
          {places.map((p) => (
            <li key={p.city_id} className="card group-card popular-group">
              <span className="trip-text">
                <strong>{p.city}</strong>
                <span className="hint">{p.members} members going</span>
              </span>
              {canStart && (
                <Link className="btn btn-secondary btn-small" to="/groups/new" state={{ city: { id: p.city_id, name: p.city, country_code: p.country_code } }}>
                  Start a group
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
