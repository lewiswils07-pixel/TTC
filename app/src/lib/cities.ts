import { friendlyError } from './errors'
import { supabase } from './supabase'

/** `region` is the county for UK towns, from the town search (database Part 25). */
export type City = { id: number; name: string; country_code: string; region?: string | null }

const regionNames = new Intl.DisplayNames(['en-GB'], { type: 'region' })

/** "Lisbon, Portugal", or "St Ives, Cornwall" for a UK town with its county (testers, 13 Oct). */
export function cityLabel(city: Pick<City, 'name' | 'country_code' | 'region'>): string {
  if (city.country_code === 'GB' && city.region && city.region !== city.name) return `${city.name}, ${city.region}`
  let country = city.country_code
  try {
    country = regionNames.of(city.country_code) ?? country
  } catch {
    // Unknown code: show it as it is.
  }
  return `${city.name}, ${country}`
}

/** Cities whose name starts with what the member typed, biggest first. Text after a comma narrows by county or country. */
export async function searchCities(query: string): Promise<City[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const { data, error } = await supabase.rpc('search_cities', { q })
  if (error) throw friendlyError(error)
  return (data ?? []) as City[]
}
