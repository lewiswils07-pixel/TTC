// Suggestions of other members. The database picks and ranks them and
// returns only public fields (name, age, home town, photo, shared interests).
import { cityLabel } from './cities'
import { tripDates } from './dates'
import { friendlyError } from './errors'
import { supabase } from './supabase'

export type TripSuggestion = {
  profile_id: string
  display_name: string
  birth_year: number | null
  home_city: string | null
  home_country: string | null
  photo_path: string | null
  travelling_with: string | null
  trip_city: string
  trip_start: string
  trip_end: string
  overlap_start: string | null
  overlap_end: string | null
  shared_interests: string[]
  score: number
}

/** Members going to the same place at the same time, best match first. */
export async function suggestForTrip(tripId: number): Promise<TripSuggestion[]> {
  const { data, error } = await supabase.rpc('suggest_for_trip', { p_trip_id: tripId })
  if (error) throw friendlyError(error)
  return (data ?? []) as TripSuggestion[]
}

/** People on this trip you're already in touch with: connected, asked either way, or in a group together. */
export type TripCompanion = {
  profile_id: string
  display_name: string
  birth_year: number | null
  home_city: string | null
  home_country: string | null
  photo_path: string | null
  status: 'connected' | 'you_asked' | 'they_asked' | 'group'
  trip_start: string
  trip_end: string
  overlap_start: string | null
  overlap_end: string | null
}

/** Empty when this database doesn't have the list yet. */
export async function tripCompanions(tripId: number): Promise<TripCompanion[]> {
  const { data, error } = await supabase.rpc('trip_companions', { p_trip_id: tripId })
  if (error?.code === 'PGRST202') return []
  if (error) throw friendlyError(error)
  return (data ?? []) as TripCompanion[]
}

/** Words instead of a number on each card (Lewis, 5 Oct). Thresholds suit
 *  the 0 to 100 score from the database. */
export function fitWords(score: number): string {
  if (score >= 70) return 'Lots in common'
  if (score >= 50) return 'Plenty in common'
  return 'Worth a look'
}

/** "Museums", "Museums and Theatre", "Museums, Theatre and 2 more". */
export function listLabels(labels: string[], max = 2): string {
  if (labels.length <= max) return labels.join(' and ')
  const rest = labels.length - max
  return `${labels.slice(0, max).join(', ')} and ${rest} more`
}

/** The lines on a card that say why we suggested this person. */
export function reasons(s: TripSuggestion, myCityName: string): string[] {
  const lines: string[] = []
  if (s.shared_interests.length) lines.push(`Both into ${listLabels(s.shared_interests)}`)
  const where = s.trip_city === myCityName ? '' : ` in ${s.trip_city}`
  lines.push(
    s.overlap_start && s.overlap_end
      ? `There at the same time${where}: ${tripDates(s.overlap_start, s.overlap_end)}`
      : `Dates close to yours${where}: ${tripDates(s.trip_start, s.trip_end)}`,
  )
  return lines
}

export function homeLabel(s: Pick<TripSuggestion, 'home_city' | 'home_country'>): string | null {
  return s.home_city && s.home_country ? cityLabel({ name: s.home_city, country_code: s.home_country }) : null
}

export type InterestSuggestion = {
  profile_id: string
  display_name: string
  birth_year: number | null
  home_city: string | null
  home_country: string | null
  photo_path: string | null
  travelling_with: string | null
  distance_km: number | null
  shared_interests: string[]
  shared_places: string[]
  score: number
}

/** Up to 20 members who share at least 2 interests, for planning something new. */
export async function suggestByInterests(): Promise<InterestSuggestion[]> {
  const { data, error } = await supabase.rpc('suggest_by_interests')
  if (error) throw friendlyError(error)
  return (data ?? []) as InterestSuggestion[]
}

/** Why we suggested someone with no trip in common. */
export function interestReasons(s: InterestSuggestion): string[] {
  const lines = [`Both into ${listLabels(s.shared_interests)}`]
  if (s.shared_places.length) lines.push(`You both want to visit ${listLabels(s.shared_places)}`)
  if (s.distance_km !== null) lines.push(s.distance_km < 10 ? 'Lives near you' : `Lives about ${roundMiles(s.distance_km)} miles from you`)
  return lines
}

/** Members think in miles: "about 20 miles", "about 150 miles". */
function roundMiles(km: number): number {
  const miles = km / 1.609344
  return miles < 60 ? Math.max(5, Math.round(miles / 5) * 5) : Math.round(miles / 25) * 25
}
