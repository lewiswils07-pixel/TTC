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
  trip_city: string
  trip_start: string
  trip_end: string
  overlap_start: string | null
  overlap_end: string | null
  shared_interests: string[]
  score: number
}

/** Up to 20 members going to the same place at the same time, best match first. */
export async function suggestForTrip(tripId: number): Promise<TripSuggestion[]> {
  const { data, error } = await supabase.rpc('suggest_for_trip', { p_trip_id: tripId })
  if (error) throw friendlyError(error)
  return (data ?? []) as TripSuggestion[]
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
  if (s.distance_km !== null) lines.push(s.distance_km < 10 ? 'Lives near you' : `Lives about ${roundKm(s.distance_km)} km from you`)
  return lines
}

function roundKm(km: number): number {
  return km < 100 ? Math.round(km / 5) * 5 : Math.round(km / 50) * 50
}
