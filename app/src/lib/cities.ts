import { friendlyError } from './errors'
import { supabase } from './supabase'

export type City = { id: number; name: string; country_code: string }

const regionNames = new Intl.DisplayNames(['en-GB'], { type: 'region' })

export function cityLabel(city: Pick<City, 'name' | 'country_code'>): string {
  let country = city.country_code
  try {
    country = regionNames.of(city.country_code) ?? country
  } catch {
    // Unknown code: show it as it is.
  }
  return `${city.name}, ${country}`
}

/** Cities whose name starts with what the member typed, biggest first. */
export async function searchCities(query: string): Promise<City[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const { data, error } = await supabase.rpc('search_cities', { q })
  if (error) throw friendlyError(error)
  return (data ?? []) as City[]
}
