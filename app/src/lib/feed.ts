// The "For you" feed on the Connections tab: everyone the database suggests
// for the member's trips and for their interests, merged into one list of
// people, each with gold callouts saying why they're there (Lewis, 5 Oct).
import { shortDates } from './dates'
import { listLabels, suggestByInterests, suggestForTrip, type InterestSuggestion, type TripSuggestion } from './matching'
import { listMyTrips } from './trips'
import { rules } from './rules'
import { supabase } from './supabase'

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
  /** Their trip's dates. `overlap` is true when they're there at the same time as you, not just on nearby dates. */
  trips: { city: string; start: string; end: string; overlap: boolean }[]
  shared_interests: string[]
  shared_places: string[]
  distance_km: number | null
  /** Used the app in the last day (rules.connections.recentlyOnlineHours). */
  online: boolean
}

/** Shared interests needed for the “Similar interests” callout (out of the ones each member picks). */
export const SIMILAR_INTERESTS = 3

/** `trip` is a trip at the same time as one of yours; `trip-close` is on nearby dates.
 *  `hint` is read out after the text, since the two differ only by colour on screen. */
export type Callout = { kind: 'trip' | 'trip-close' | 'interests' | 'home' | 'places'; text: string; hint?: string }

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
    online: false,
  })
  for (const { tripId, people: list } of byTrip) {
    for (const s of list) {
      const p = people.get(s.profile_id) ?? base(s)
      p.trip_id ??= tripId
      p.score = Math.max(p.score, s.score)
      p.trips.push({ city: s.trip_city, start: s.trip_start, end: s.trip_end, overlap: !!(s.overlap_start && s.overlap_end) })
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

/** The first trip where this person is there at the same time as the member, if any. */
export const sameTime = (p: FeedPerson) => p.trips.find((t) => t.overlap)

/** Everyone suggested for the member's next 5 trips and for their interests. */
export async function loadFeed(): Promise<FeedPerson[]> {
  const trips = ((await listMyTrips().catch(() => null)) ?? []).slice(0, 5)
  const [byTrip, byInterest] = await Promise.all([
    Promise.all(trips.map(async (t) => ({ tripId: t.id, people: await suggestForTrip(t.id).catch(() => []) }))),
    suggestByInterests(),
  ])
  const feed = mergeFeed(byTrip, byInterest)
  const online = await recentlyOnline(feed.map((p) => p.profile_id))
  for (const p of feed) p.online = online.has(p.profile_id)
  return feed
}

/** Which of these people used the app recently. Empty if the database can't say yet. */
export async function recentlyOnline(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const { data, error } = await supabase.rpc('recently_online', { p_ids: ids.slice(0, 100) })
  return new Set(error ? [] : ((data ?? []) as string[]))
}

/** Why this person is in the feed, strongest reason first. Short and plain
 *  (Lewis, 7 Oct): "London", not "Also from London"; a trip is its place and
 *  dates, coloured by whether it's at the same time as yours. */
export function callouts(p: FeedPerson, myHomeCity: string | null, today?: string): Callout[] {
  const lines: Callout[] = p.trips.map((t) => ({
    kind: t.overlap ? 'trip' : 'trip-close',
    text: `${t.city} · ${shortDates(t.start, t.end, today)}`,
    hint: t.overlap ? 'same dates as you' : 'close to your dates',
  }))
  // Kept general on purpose (Lewis, 5 Oct): the card lists the interests themselves.
  if (p.shared_interests.length >= SIMILAR_INTERESTS) lines.push({ kind: 'interests', text: 'Similar interests' })
  if (myHomeCity && p.home_city === myHomeCity) lines.push({ kind: 'home', text: p.home_city, hint: 'lives in your town' })
  else if (p.distance_km !== null && p.distance_km < 30) lines.push({ kind: 'home', text: 'Near you' })
  if (p.shared_places.length) lines.push({ kind: 'places', text: `Wants to visit ${listLabels(p.shared_places)}` })
  return lines
}

function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])]
}

// "Not now" hides someone for 30 days. It's kept on this phone only, so it
// doesn't need a database change; it never uses up a request.
export const NOT_NOW_DAYS = rules.connections.notNowDays
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
