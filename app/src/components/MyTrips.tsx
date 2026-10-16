import { useCallback, useEffect, useState } from 'react'
import { peek, remember } from '../lib/cache'
import { SkeletonRows } from './Skeleton'
import { EmptyState } from './EmptyState'
import { Link } from 'react-router'
import { cityLabel, type City } from '../lib/cities'
import { startsIn, tripDates } from '../lib/dates'
import { loadFeed, type FeedPerson } from '../lib/feed'
import { BriefcaseBusiness, Lock } from 'lucide-react'
import { Avatar } from './Avatar'
import { messageOf } from '../lib/errors'
import { rules } from '../lib/rules'
import { addToWishlist, listMyTrips, listWishlist, removeFromWishlist, type Trip, type WishlistItem } from '../lib/trips'
import { CityPicker } from './CityPicker'
import { CityPhoto } from './CityPhoto'
import { CloseIcon, NextIcon } from './Icons'

const MAX_WISHLIST = rules.wishlist.max

/** The member's upcoming trips as big cards: the place, the dates, how soon, and who's going (Claude Design, 15 Oct). */
export function MyTrips() {
  const [trips, setTrips] = useState<Trip[] | null | undefined>(() => peek('trips'))
  const [feed, setFeed] = useState<FeedPerson[] | null>(() => peek<FeedPerson[]>('feed') ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    remember('trips', listMyTrips()).then(setTrips, (e) => setError(messageOf(e)))
    remember('feed', loadFeed()).then(setFeed, () => setFeed([]))
  }, [])

  if (trips === null) return null
  return (
    <section className="trip-cards" aria-label="Your trips">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {trips === undefined && !error && <SkeletonRows rows={2} label="Loading your trips…" />}
      {trips && trips.length === 0 && (
        <EmptyState icon={<BriefcaseBusiness size={18} strokeWidth={2} />} title="No trips yet" text="Add where you’re going and when, and you’ll see members heading the same way.">
          <Link className="btn btn-primary btn-block" to="/trips/new">
            Add your first trip
          </Link>
        </EmptyState>
      )}
      {trips && trips.length > 0 && (
        <ul className="trip-card-list">
          {trips.map((trip) => {
            const going = (feed ?? []).filter((p) => p.trips.some((t) => t.mine === trip.id))
            return (
              <li key={trip.id}>
                <Link className="card trip-card" to={`/trips/${trip.id}`}>
                  <span className="trip-card-top">
                    <CityPhoto city={trip.city.name} width={720} code className="trip-card-photo" />
                    <span className="trip-card-when">{startsIn(trip.start_date, trip.end_date)}</span>
                  </span>
                  <span className="trip-card-body">
                    <strong className="trip-card-city">{cityLabel(trip.city)}</strong>
                    <span className="trip-card-dates">{tripDates(trip.start_date, trip.end_date)}</span>
                    <span className="trip-card-foot">
                      {trip.visibility === 'hidden' ? (
                        <>
                          <Lock size={18} strokeWidth={1.8} aria-hidden="true" />
                          <span>Only you can see this trip</span>
                        </>
                      ) : going.length > 0 ? (
                        <>
                          <span className="face-stack" aria-hidden="true">
                            {going.slice(0, 3).map((p) => (
                              <Avatar key={p.profile_id} name={p.display_name} path={p.photo_path} size="sm" />
                            ))}
                          </span>
                          <strong>{going.length === 1 ? '1 member going' : `${going.length} members going`}</strong>
                        </>
                      ) : (
                        <span>See who’s going</span>
                      )}
                      <NextIcon />
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Places the member would love to visit one day, used to match people with no trip booked yet. */
export function Wishlist() {
  const [items, setItems] = useState<WishlistItem[] | null | undefined>(() => peek('wishlist'))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Changing the key resets the picker after each add.
  const [pickerKey, setPickerKey] = useState(0)

  const load = useCallback(() => remember('wishlist', listWishlist()).then(setItems, (e) => setError(messageOf(e))), [])
  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  async function add(city: City | null) {
    if (!city) return
    setPickerKey((k) => k + 1)
    if (items?.some((i) => i.city_id === city.id)) return setError(`${city.name} is already on your list.`)
    await run(() => addToWishlist(city.id))
  }

  const full = (items?.length ?? 0) >= MAX_WISHLIST
  if (items === null) return null

  return (
    <section className="card section-card" aria-labelledby="wishlist">
      <div className="section-head">
        <h2 id="wishlist">Places I’d love to go</h2>
      </div>
      <p className="hint">No dates yet? Save up to {MAX_WISHLIST} places and we’ll suggest members who want to go too.</p>
      {items && items.length > 0 && (
        <ul className="chip-list" aria-label="Saved places">
          {items.map((item) => (
            <li key={item.city_id}>
              <button type="button" className="chip-remove" aria-label={`Remove ${cityLabel(item.city)}`} disabled={busy} onClick={() => run(() => removeFromWishlist(item.city_id))}>
                {cityLabel(item.city)} <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      {items && !full && <CityPicker key={pickerKey} label="Add a place" value={null} onChange={add} />}
      {full && <p className="hint">Your list is full. Remove a place to add another.</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
