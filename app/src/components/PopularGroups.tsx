import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { brand } from '../lib/brand'
import { CityPhoto } from './CityPhoto'
import { peek, remember } from '../lib/cache'
import { hasPlus, plusLink } from '../lib/plan'
import { popularDestinations, type PopularPlace } from '../lib/trips'

const SHOWN = 3

/** Sodalis+ on Groups: places members are heading right now, each a tap away from starting a trip group there (Lewis, 11 Oct). */
export function PopularGroups({ canStart }: { canStart: boolean }) {
  const [plus, setPlus] = useState<boolean | null>(null)
  const [places, setPlaces] = useState<PopularPlace[] | undefined>(() => peek('popular'))
  const [all, setAll] = useState(false)

  useEffect(() => {
    hasPlus().then(setPlus, () => setPlus(false))
    remember('popular', popularDestinations()).then(setPlaces, () => setPlaces([]))
  }, [])

  if (plus === null || !places?.length) return null
  return (
    <section className="popular-groups" aria-labelledby="popular-groups-title">
      {/* The badge sits by the heading and always says what it's for (testers, 13 and 21 Oct). */}
      <div className="list-label-row">
        <h2 className="list-label" id="popular-groups-title">
          Popular right now
        </h2>
        <span className="tag tag-plus-dark">{brand.plusName}</span>
      </div>
      <p className="hint list-hint">Where members are heading now, so you can start a group for one. {!plus && <Link to={plusLink('groups')}>Comes with {brand.plusName}</Link>}</p>
      {plus && (
        <ul className="chat-list">
          {(all ? places : places.slice(0, SHOWN)).map((p) => (
            <li key={p.city_id} className="chat-row popular-group">
              <CityPhoto city={p.city} width={120} code className="group-tile" />
              <span className="chat-row-text">
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
      {plus && places.length > SHOWN && (
        <button type="button" className="btn-link" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${places.length}`}
        </button>
      )}
    </section>
  )
}
