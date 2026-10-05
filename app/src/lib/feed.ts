// The "For you" feed on the Connections tab: everyone the database suggests
// for the member's trips and for their interests, merged into one list of
// people, each with gold callouts saying why they're there (Lewis, 5 Oct).
import { tripDates } from './dates'
import { listLabels, suggestByInterests, suggestForTrip, type InterestSuggestion, type TripSuggestion } from './matching'
import { listMyTrips } from './trips'

export type FeedPerson = {
  profile_id: string
  display_name: string
  birth_year: number | null
  home_city: string | null
  home_country: string | null
  photo_path: string | null
  travelling_with: string | null
  score: number
  /** The member's trip this person matched, for the request (the first one if several). */
  trip_id: number | null
  trips: { city: string; start: string; end: string }[]
  shared_interests: string[]
  shared_places: string[]
  distance_km: number | null
}

/** Shared interests needed for the “Similar interests” callout (out of the 7 each member picks). */
export const SIMILAR_INTERESTS = 3

export type Callout = { kind: 'trip' | 'interests' | 'home' | 'places'; text: string }

/** One list of people from trip and interest suggestions: trip matches first, then best score. */
export function mergeFeed(byTrip: { tripId: number; people: TripSuggestion[] }[], byInterest: InterestSuggestion[]): FeedPerson[] {
  const people = new Map<string, FeedPerson>()
  const base = (s: TripSuggestion | InterestSuggestion): FeedPerson => ({
    profile_id: s.profile_id,
    display_name: s.display_name,
    birth_year: s.birth_year,
    home_city: s.home_city,
    home_country: s.home_country,
    photo_path: s.photo_path,
    travelling_with: s.travelling_with,
    score: s.score,
    trip_id: null,
    trips: [],
    shared_interests: [],
    shared_places: [],
    distance_km: null,
  })
  for (const { tripId, people: list } of byTrip) {
    for (const s of list) {
      const p = people.get(s.profile_id) ?? base(s)
      p.trip_id ??= tripId
      p.score = Math.max(p.score, s.score)
      p.trips.push({ city: s.trip_city, start: s.overlap_start ?? s.trip_start, end: s.overlap_end ?? s.trip_end })
      p.shared_interests = union(p.shared_interests, s.shared_interests)
      people.set(s.profile_id, p)
    }
  }
  for (const s of byInterest) {
    const p = people.get(s.profile_id) ?? base(s)
    p.score = Math.max(p.score, s.score)
    p.shared_interests = union(p.shared_interests, s.shared_interests)
    p.shared_places = union(p.shared_places, s.shared_places)
    p.distance_km = s.distance_km
    people.set(s.profile_id, p)
  }
  return [...people.values()].sort((a, b) => Number(b.trips.length > 0) - Number(a.trips.length > 0) || b.score - a.score)
}

/** Everyone suggested for the member's next 5 trips and for their interests. */
export async function loadFeed(): Promise<FeedPerson[]> {
  const trips = ((await listMyTrips().catch(() => null)) ?? []).slice(0, 5)
  const [byTrip, byInterest] = await Promise.all([
    Promise.all(trips.map(async (t) => ({ tripId: t.id, people: await suggestForTrip(t.id).catch(() => []) }))),
    suggestByInterests(),
  ])
  return mergeFeed(byTrip, byInterest)
}

/** Why this person is in the feed, strongest reason first. */
export function callouts(p: FeedPerson, myHomeCity: string | null): Callout[] {
  const lines: Callout[] = p.trips.map((t) => ({ kind: 'trip', text: `Also going to ${t.city}, ${tripDates(t.start, t.end)}` }))
  // Kept general on purpose (Lewis, 5 Oct): the card lists the interests themselves.
  if (p.shared_interests.length >= SIMILAR_INTERESTS) lines.push({ kind: 'interests', text: 'Similar interests' })
  if (myHomeCity && p.home_city === myHomeCity) lines.push({ kind: 'home', text: `Also from ${p.home_city}` })
  else if (p.distance_km !== null && p.distance_km < 30) lines.push({ kind: 'home', text: 'Lives near you' })
  if (p.shared_places.length) lines.push({ kind: 'places', text: `Also wants to visit ${listLabels(p.shared_places)}` })
  return lines
}

function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])]
}

// "Not now" hides someone for 30 days. It's kept on this phone only, so it
// doesn't need a database change; it never uses up a request.
const NOT_NOW_DAYS = 30
const key = (me: string) => `sodalis.notNow.${me}`

export function notNowIds(me: string, now = Date.now()): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(key(me)) ?? '{}') as Record<string, number>
    return new Set(Object.entries(saved).flatMap(([id, at]) => (now - at < NOT_NOW_DAYS * 86_400_000 ? [id] : [])))
  } catch {
    return new Set()
  }
}

export function saveNotNow(me: string, profileId: string, now = Date.now()): void {
  try {
    const saved = JSON.parse(localStorage.getItem(key(me)) ?? '{}') as Record<string, number>
    saved[profileId] = now
    localStorage.setItem(key(me), JSON.stringify(saved))
  } catch {
    // Private browsing: they just show again next time.
  }
}

/** Undo one "Not now". */
export function forgetNotNow(me: string, profileId: string): void {
  try {
    const saved = JSON.parse(localStorage.getItem(key(me)) ?? '{}') as Record<string, number>
    delete saved[profileId]
    localStorage.setItem(key(me), JSON.stringify(saved))
  } catch {
    // Nothing saved.
  }
}

export function clearNotNow(me: string): void {
  try {
    localStorage.removeItem(key(me))
  } catch {
    // Nothing saved.
  }
}
