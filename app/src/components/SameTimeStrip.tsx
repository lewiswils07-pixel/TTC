import { Link } from 'react-router'
import { shortDates } from '../lib/dates'
import { sameTime, type FeedPerson } from '../lib/feed'
import { Avatar } from './Avatar'

/** “Going when you are”: people on the same trip at the same time, in their own tile. Hidden when there's no one. */
export function SameTimeStrip({ people }: { people: FeedPerson[] }) {
  const going = people.filter((p) => sameTime(p) && p.trip_id !== null)
  if (going.length === 0) return null
  return (
    <section className="same-time" aria-labelledby="same-time-title">
      <h2 id="same-time-title" className="same-time-title">
        Going when you are
      </h2>
      <p className="same-time-hint">
        {going.length === 1 ? '1 member is' : `${going.length} members are`} on one of your trips at the same time. Tap to see the trip.
      </p>
      <ul className="same-time-list">
        {going.map((p) => {
          const trip = sameTime(p)!
          return (
            <li key={p.profile_id}>
              <Link className="same-time-person" to={`/trips/${p.trip_id}`}>
                <Avatar name={p.display_name} path={p.photo_path} size="lg" />
                <span className="same-time-name">{p.display_name}</span>
                <span className="same-time-trip">
                  {trip.city} · {shortDates(trip.start, trip.end)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
