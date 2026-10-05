// Who the member wants to see in suggestions. Age, gender and distance
// apply to everyone; the Sodalis+ filters are saved for anyone but only
// applied by the server while the member has Sodalis+.
import { friendlyError } from './errors'
import type { Budget, Gender, Pace, TravelStyle } from './options'
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

