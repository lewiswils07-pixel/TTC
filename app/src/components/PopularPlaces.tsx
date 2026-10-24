import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { peek, remember } from '../lib/cache'
import { CityPhoto } from './CityPhoto'
import { popularDestinations, type PopularPlace } from '../lib/trips'

/** "Where members are heading": popular cities for upcoming trips. Tapping one starts a trip there. Hidden until there are some. */
export function PopularPlaces() {
  const [places, setPlaces] = useState<PopularPlace[] | undefined>(() => peek('popular'))
  useEffect(() => {
    remember('popular', popularDestinations()).then(setPlaces, () => setPlaces([]))
  }, [])
  if (!places?.length) return null
  return (
    <section className="popular" aria-labelledby="popular-title">
      <h2 className="section-title" id="popular-title">
        Where members are heading
      </h2>
      <ul className="popular-list">
        {places.map((p) => (
          <li key={p.city_id}>
            <Link
              className="popular-place"
              to="/trips/new"
              state={{ city: { id: p.city_id, name: p.city, country_code: p.country_code } }}
              aria-label={`${p.city}, ${p.members} members planning a trip. Plan a trip there`}
            >
              <CityPhoto city={p.city} country={p.country_code} width={300} className="popular-photo" />
              <strong>{p.city}</strong>
              <span>{p.members} planning</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
