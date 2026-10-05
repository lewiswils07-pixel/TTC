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
