import { Link } from 'react-router'
import { brand } from '../lib/brand'
import { sameTime, type FeedPerson } from '../lib/feed'
import { Avatar } from './Avatar'

/** Members going to the same place as you, at the same time (with a trip to match one of yours). */
export const goingWhenYouAre = (people: FeedPerson[]) => people.filter((p) => sameTime(p) && p.trip_id !== null)

/** “Trips in common”: a quiet row of faces that opens the Sodalis+ page. Hidden when there's no one. */
export function SameTimeStrip({ people }: { people: FeedPerson[] }) {
  const going = goingWhenYouAre(people)
  if (going.length === 0) return null
  const shown = going.slice(0, 3)
  return (
    <Link className="same-time" to="/connections/same-time">
      <span className="same-time-text">
        <span className="same-time-title">Trips in common</span>
        <span className="tag tag-plus">{brand.plusName}</span>
      </span>
      <span className="same-time-faces" aria-hidden="true">
        {shown.map((p) => (
          <Avatar key={p.profile_id} name={p.display_name} path={p.photo_path} size="sm" />
        ))}
        {going.length > shown.length && <span className="same-time-more">+{going.length - shown.length}</span>}
      </span>
      <span className="visually-hidden">, {going.length === 1 ? '1 member' : `${going.length} members`}</span>
      <svg className="same-time-chevron" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}
