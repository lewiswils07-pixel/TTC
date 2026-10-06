import { useCallback, useEffect, useState } from 'react'
import { peek, remember } from '../lib/cache'
import { SkeletonRows } from './Skeleton'
import { Link } from 'react-router'
import { cityLabel, type City } from '../lib/cities'
import { tripDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { rules } from '../lib/rules'
import { addToWishlist, flexibilityLabel, listMyTrips, listWishlist, removeFromWishlist, type Trip, type WishlistItem } from '../lib/trips'
import { CityPicker } from './CityPicker'

const MAX_WISHLIST = rules.wishlist.max

/** The member's upcoming trips, each linking to its edit screen. */
export function MyTrips() {
  const [trips, setTrips] = useState<Trip[] | null | undefined>(() => peek('trips'))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    remember('trips', listMyTrips()).then(setTrips, (e) => setError(messageOf(e)))
  }, [])

  if (trips === null) return null
  return (
    <section className="card section-card" aria-labelledby="my-trips">
      <div className="section-head">
        <h2 id="my-trips">My trips</h2>
        {trips && trips.length > 0 && (
          <Link className="btn btn-secondary btn-small" to="/trips/new">
            Add a trip
          </Link>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {trips === undefined && !error && <SkeletonRows rows={2} label="Loading your trips…" />}
      {trips && trips.length === 0 && (
        <div className="empty">
          <p>Add where you’re going and when. We’ll use it to find members travelling at the same time.</p>
          <Link className="btn btn-primary btn-block" to="/trips/new">
            Add your first trip
          </Link>
        </div>
      )}
      {trips && trips.length > 0 && (
        <ul className="trip-list">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link className="trip-row" to={`/trips/${trip.id}`} aria-label={`${cityLabel(trip.city)}, ${tripDates(trip.start_date, trip.end_date)}. See who’s going`}>
                <span className="trip-pin" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" fill="currentColor" />
                  </svg>
                </span>
                <span className="trip-text">
                  <strong>{cityLabel(trip.city)}</strong>
                  <span className="trip-meta">
                    {tripDates(trip.start_date, trip.end_date)}
                    {flexibilityLabel(trip.flexible_days) && ` · ${flexibilityLabel(trip.flexible_days)}`}
                  </span>
                  {trip.visibility === 'hidden' && <span className="tag tag-muted">Hidden</span>}
                </span>
                <span className="trip-chevron" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          ))}
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
                {cityLabel(item.city)} <span aria-hidden="true">×</span>
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
