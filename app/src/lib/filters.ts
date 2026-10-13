// Who the member wants to see in suggestions. Age, gender and distance
// apply to everyone; the Sodalis+ filters are saved for anyone but only
// applied by the server while the member has Sodalis+.
import { friendlyError } from './errors'
import { INTERESTED_IN, type Gender } from './options'
import { checkAgeRange } from './validation'
import { supabase } from './supabase'

export type Filters = {
  age_min: number
  age_max: number
  genders: Gender[]
  max_distance_km: number | null
  age_flexible: boolean
  distance_flexible: boolean
  verified_only: boolean
} & Record<PlusFilter, string[]>

/** Every Sodalis+ filter: one per travel style question and holiday preference (Lewis, 11 Oct). */
export const PLUS_FILTERS = ['paces', 'budgets', 'styles', 'movings', 'travel_oftens', 'bookings', 'group_sizes', 'stays', 'lengths', 'seasons'] as const
export type PlusFilter = (typeof PLUS_FILTERS)[number]
export const NO_PLUS_FILTERS = Object.fromEntries(PLUS_FILTERS.map((k) => [k, []])) as unknown as Record<PlusFilter, string[]>

const COLUMNS = `age_min, age_max, genders, max_distance_km, age_flexible, distance_flexible, verified_only, ${PLUS_FILTERS.join(', ')}`

export async function getFilters(userId: string): Promise<Filters> {
  const { data, error } = await supabase.from('preferences').select(COLUMNS).eq('profile_id', userId).single()
  if (error) throw friendlyError(error)
  return data as unknown as Filters
}

export async function saveFilters(userId: string, filters: Filters): Promise<void> {
  const { error } = await supabase.from('preferences').update(filters).eq('profile_id', userId)
  if (error) throw friendlyError(error)
}

/** Who they'd like to meet, from sign-up (Lewis, 11 Oct). */
export async function saveMeetPreferences(userId: string, prefs: Pick<Filters, 'genders' | 'age_min' | 'age_max' | 'max_distance_km'>): Promise<void> {
  const { error } = await supabase.from('preferences').update(prefs).eq('profile_id', userId)
  if (error) throw friendlyError(error)
}

/** What the "I’d like to travel with" row says when closed. */
export function interestedInText(genders: readonly string[]): string {
  if (INTERESTED_IN.every((o) => genders.includes(o.value))) return 'Everyone'
  return (
    INTERESTED_IN.filter((o) => genders.includes(o.value))
      .map((o) => o.label)
      .join(', ') || 'Choose who'
  )
}

export function filterErrors(f: Filters) {
  return { genders: f.genders.length ? null : 'Choose at least one option.', ages: checkAgeRange([f.age_min, f.age_max]) }
}
