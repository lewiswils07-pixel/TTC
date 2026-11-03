// The "For you" feed on the Connections tab: everyone the database suggests
// for the member's trips and for their interests, merged into one list of
// people, each with gold callouts saying why they're there (Lewis, 5 Oct).
import { monthName, shortDates } from './dates'
import { hasPlus } from './plan'
import { verifiedIds } from './verify'
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
  /** Ordering only: the score less filter and activity adjustments, plus the same-trip bump. */
  rank: number
  /** The member's trip this person matched, for the request (the first one if several). */
  trip_id: number | null
  /** Their trip's dates. `overlap` is true when they're there at the same time as you, not just on nearby dates.
   *  Exact dates and the days you're both there are free for everyone (round 8, 23 Oct). */
  /** Their trips near yours; `mine` is the id of your trip it matched. */
  trips: { city: string; start: string; end: string; overlap: boolean; exact: boolean; days: { start: string; end: string } | null; mine?: number }[]
  shared_interests: string[]
  shared_places: string[]
  distance_km: number | null
  /** Used the app in the last day (rules.connections.recentlyOnlineHours). */
  online: boolean
  /** Has the Verified badge (round 8, 23 Oct). */
  verified: boolean
}

/** Shared interests needed for the “Similar interests” callout (out of the ones each member picks). */
export const SIMILAR_INTERESTS = 3

/** `trip` is a trip at the same time as one of yours; `trip-close` is on nearby dates.
 *  `hint` is read out after the text, since the two differ only by colour on screen. */
export type Callout = { kind: 'trip' | 'trip-close' | 'interests' | 'home' | 'places'; text: string; hint?: string }

/** One list of people from trip and interest suggestions, best rank first. Sodalis+
 *  members see people there at the same time pinned to the top; for everyone else a
 *  shared trip is a bump in the rank, not a pin (Lewis, 11 Oct). */
export function mergeFeed(byTrip: { tripId: number; people: TripSuggestion[] }[], byInterest: InterestSuggestion[], plus = false): FeedPerson[] {
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
    rank: s.rank,
    trip_id: null,
    trips: [],
    shared_interests: [],
    shared_places: [],
    distance_km: null,
    online: false,
    verified: false,
  })
  for (const { tripId, people: list } of byTrip) {
    for (const s of list) {
      const p = people.get(s.profile_id) ?? base(s)
      p.trip_id ??= tripId
      p.score = Math.max(p.score, s.score)
      p.rank = Math.max(p.rank, s.rank)
      const overlap = !!(s.overlap_start && s.overlap_end)
      p.trips.push({ city: s.trip_city, start: s.trip_start, end: s.trip_end, overlap, exact: true, days: overlap ? { start: s.overlap_start!, end: s.overlap_end! } : null, mine: tripId })
      p.shared_interests = union(p.shared_interests, s.shared_interests)
      people.set(s.profile_id, p)
    }
  }
  for (const s of byInterest) {
    const p = people.get(s.profile_id) ?? base(s)
    p.score = Math.max(p.score, s.score)
    p.rank = Math.max(p.rank, s.rank)
    p.shared_interests = union(p.shared_interests, s.shared_interests)
    p.shared_places = union(p.shared_places, s.shared_places)
    p.distance_km = s.distance_km
    people.set(s.profile_id, p)
  }
  const pinned = (p: FeedPerson) => Number(plus && !!sameTime(p))
  return [...people.values()].sort((a, b) => pinned(b) - pinned(a) || b.rank - a.rank)
}

/** The first trip where this person is there at the same time as the member, if any. */
export const sameTime = (p: FeedPerson) => p.trips.find((t) => t.overlap)

/** Everyone suggested for the member's next 5 trips and for their interests. */
export async function loadFeed(): Promise<FeedPerson[]> {
  const trips = ((await listMyTrips().catch(() => null)) ?? []).slice(0, 5)
  const [byTrip, byInterest, plus] = await Promise.all([Promise.all(trips.map(async (t) => ({ tripId: t.id, people: await suggestForTrip(t.id).catch(() => []) }))), suggestByInterests(), hasPlus()])
  const feed = mergeFeed(byTrip, byInterest, plus)
  const ids = feed.map((p) => p.profile_id)
  const [online, verified] = await Promise.all([recentlyOnline(ids), verifiedIds(ids)])
  for (const p of feed) {
    p.online = online.has(p.profile_id)
    p.verified = verified.has(p.profile_id)
  }
  return feed
}

/** Which of these people used the app recently. Empty if the database can't say yet. */
export async function recentlyOnline(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const { data, error } = await supabase.rpc('recently_online', { p_ids: ids.slice(0, 100) })
  return new Set(error ? [] : ((data ?? []) as string[]))
}

/** Why this person is in the feed, strongest reason first: a trip is its place
 *  and dates, coloured by whether it's at the same time as yours. */
export function callouts(p: FeedPerson, today?: string): Callout[] {
  const lines: Callout[] = p.trips.map((t) =>
    // Exact dates are free (round 8, 23 Oct). A month shows only if the server sends no exact dates.
    !t.exact
      ? { kind: t.overlap ? 'trip' : 'trip-close', text: `Also going to ${t.city} in ${monthName(t.start)}`, hint: t.overlap ? 'around the same time as you' : 'close to your dates' }
      : {
          kind: t.overlap ? 'trip' : 'trip-close',
          text: `${t.city} · ${shortDates(t.start, t.end, today)}`,
          hint: t.overlap ? 'same dates as you' : 'close to your dates',
        },
  )
  // Kept general on purpose (Lewis, 5 Oct): the card lists the interests themselves.
  if (p.shared_interests.length >= SIMILAR_INTERESTS) lines.push({ kind: 'interests', text: 'Similar interests' })
  if (p.shared_places.length) lines.push({ kind: 'places', text: `Wants to visit ${listLabels(p.shared_places)}` })
  return lines
}

/** "What you share" with someone, in plain words, strongest first: reasons, not a rating (Lewis, 12 Oct).
 *  `trip` is the trip you're both on. */
export function whatYouShare(p: FeedPerson, trip?: FeedPerson['trips'][number], today?: string, myCity?: string): string[] {
  const lines: string[] = []
  // Their trip is to a place near yours (Maya, 13 Oct: "Both in Cascais" when she was going to Lisbon).
  if (trip && myCity && myCity !== trip.city) {
    lines.push(`${trip.city} in ${monthName(trip.start)}, near your ${myCity} trip`)
  } else if (trip) {
    lines.push(
      trip.days
        ? `Both in ${trip.city} ${shortDates(trip.days.start, trip.days.end, today)}`
        : trip.overlap
          ? `Both in ${trip.city} in ${monthName(trip.start)}`
          : `${trip.city} in ${monthName(trip.start)}, near your dates`,
    )
  }
  lines.push(...p.shared_interests.slice(0, 3))
  if (p.shared_places.length) lines.push(`Both want to see ${listLabels(p.shared_places)}`)
  return lines
}

export type TripGroup = { city: string; people: FeedPerson[] }

/** Who's going: one group per place you're going, each person under their best trip with you
 *  (there at the same time first), in feed order. Everyone else shares your interests. */
export function groupByTrip(people: FeedPerson[]): { trips: TripGroup[]; others: FeedPerson[] } {
  const trips = new Map<string, TripGroup>()
  const others: FeedPerson[] = []
  for (const p of people) {
    const t = sameTime(p) ?? p.trips[0]
    if (!t) {
      others.push(p)
      continue
    }
    const group = trips.get(t.city) ?? { city: t.city, people: [] }
    group.people.push(p)
    trips.set(t.city, group)
  }
  return { trips: [...trips.values()], others }
}

/** This person's trip to a place you're going. */
export const tripTo = (p: FeedPerson, city: string) => p.trips.find((t) => t.city === city)

/** Lives within 30 km but not in your town (their town is already on the photo). Shown as a badge on the photo (Lewis, 11 Oct). */
export const nearYou = (p: FeedPerson, myHomeCity: string | null) => p.distance_km !== null && p.distance_km < 30 && p.home_city !== myHomeCity

function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])]
}

// "Not now" hides someone for 30 days. It's kept with the account, so it
// holds on every device, and on this phone too so the card goes at once.
// It never uses up a request.
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

/** Saves a "Not now" with the account. Quietly does nothing on a database without it yet. */
export async function skipMember(profileId: string): Promise<void> {
  await supabase.rpc('skip_member', { p_id: profileId })
}

export async function unskipMember(profileId: string): Promise<void> {
  await supabase.rpc('unskip_member', { p_id: profileId })
}

export async function unskipAll(): Promise<void> {
  await supabase.rpc('unskip_all')
}

/** How many people the member has skipped in the last 30 days, on any device. */
export async function skippedCount(): Promise<number> {
  const { data, error } = await supabase.rpc('skipped_count')
  return error ? 0 : ((data as number) ?? 0)
}
