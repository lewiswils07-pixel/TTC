import { friendlyError } from './errors'
import { supabase } from './supabase'

/** `region` is the county for UK towns, from the town search (database Part 25). */
export type City = { id: number; name: string; country_code: string; region?: string | null; kind?: 'country' }

/** A country in the same shape as a city, for Places I'd love to go (Lewis, 17 Oct). Its id is negative so it never clashes with a city's. */
export const countryPlace = (code: string, name: string): City => ({ id: -(code.charCodeAt(0) * 256 + code.charCodeAt(1)), name, country_code: code, kind: 'country' })

const regionNames = new Intl.DisplayNames(['en-GB'], { type: 'region' })

/** "Lisbon, Portugal", or "St Ives, Cornwall" for a UK town with its county (testers, 13 Oct). */
export function cityLabel(city: Pick<City, 'name' | 'country_code' | 'region' | 'kind'>): string {
  if (city.kind === 'country') return city.name
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

/** Countries whose name starts with what the member typed, then towns and cities. Countries are missing before database Part 27. */
export async function searchPlaces(query: string): Promise<City[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const [countries, cities] = await Promise.all([
    supabase
      .from('countries')
      .select('code, name')
      .ilike('name', `${q.replace(/[%_,]/g, '')}%`)
      .order('name')
      .limit(3)
      .then(({ data, error }) => (error ? [] : (data ?? []).map((x: { code: string; name: string }) => countryPlace(x.code, x.name)))),
    searchCities(q),
  ])
  return [...countries, ...cities]
}
