// Who the member wants to see in suggestions. Age, gender and distance
// apply to everyone; the Sodalis+ filters are saved for anyone but only
// applied by the server while the member has Sodalis+.
import { friendlyError } from './errors'
import { INTERESTED_IN, type Budget, type Gender, type Pace, type TravelStyle } from './options'
import { checkAgeRange } from './validation'
import { supabase } from './supabase'

export type Filters = {
  age_min: number
  age_max: number
  genders: Gender[]
  max_distance_km: number | null
  verified_only: boolean
  styles: TravelStyle[]
  paces: Pace[]
  budgets: Budget[]
}

const COLUMNS = 'age_min, age_max, genders, max_distance_km, verified_only, styles, paces, budgets'

export async function getFilters(userId: string): Promise<Filters> {
  const { data, error } = await supabase.from('preferences').select(COLUMNS).eq('profile_id', userId).single()
  if (error) throw friendlyError(error)
  return data as Filters
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

/** What the "I’m interested in" row says when closed. */
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
