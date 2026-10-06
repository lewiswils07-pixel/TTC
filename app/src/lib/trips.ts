// The signed-in member's own trips and wishlist. Row-level security limits
// every query here to their own rows; the database also checks the dates.
import type { City } from './cities'
import { friendlyError } from './errors'
import { isoDate } from './dates'
import { supabase } from './supabase'

export type Visibility = 'members' | 'hidden'

export type Trip = {
  id: number
  city_id: number
  start_date: string
  end_date: string
  flexible_days: number
  note: string | null
  visibility: Visibility
  city: City
}

export type TripInput = Pick<Trip, 'city_id' | 'start_date' | 'end_date' | 'flexible_days' | 'note' | 'visibility'>

export type WishlistItem = { city_id: number; city: City }

// Until the trips tables are added to a database, the API answers with
// PGRST205 ("could not find the table"). The dashboard hides trips then.
type ApiError = { code?: string } | null
const tablesMissing = (error: ApiError) => error?.code === 'PGRST205' || error?.code === '42P01'

const TRIP_COLUMNS = 'id, city_id, start_date, end_date, flexible_days, note, visibility, city:cities(id, name, country_code)'

/**
 * Upcoming and current trips, soonest first. Trips that have ended are left
 * out. Null when this database doesn't have trips yet.
 */
export async function listMyTrips(today = isoDate(new Date())): Promise<Trip[] | null> {
  const { data, error } = await supabase.from('trips').select(TRIP_COLUMNS).gte('end_date', today).order('start_date')
  if (tablesMissing(error)) return null
  if (error) throw friendlyError(error)
  return data as unknown as Trip[]
}

export async function getTrip(id: number): Promise<Trip | null> {
  const { data, error } = await supabase.from('trips').select(TRIP_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw friendlyError(error)
  return data as unknown as Trip | null
}

/** Adds or changes a trip and returns its id. */
export async function saveTrip(trip: TripInput, id?: number): Promise<number> {
  const query = id ? supabase.from('trips').update(trip).eq('id', id) : supabase.from('trips').insert(trip)
  const { data, error } = await query.select('id').single()
  if (error) throw friendlyError(error)
  return data.id as number
}

export async function deleteTrip(id: number): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw friendlyError(error)
}

/** Null when this database doesn't have the wishlist yet. */
export async function listWishlist(): Promise<WishlistItem[] | null> {
  const { data, error } = await supabase.from('wishlist').select('city_id, city:cities(id, name, country_code)').order('created_at')
  if (tablesMissing(error)) return null
  if (error) throw friendlyError(error)
  return data as unknown as WishlistItem[]
}

export async function addToWishlist(cityId: number): Promise<void> {
  const { error } = await supabase.from('wishlist').insert({ city_id: cityId })
  if (error) throw friendlyError(error)
}

export async function removeFromWishlist(cityId: number): Promise<void> {
  const { error } = await supabase.from('wishlist').delete().eq('city_id', cityId)
  if (error) throw friendlyError(error)
}

export function flexibilityLabel(days: number): string | null {
  if (!days) return null
  // Non-breaking spaces keep "3 days" together on narrow screens.
  return days === 7 ? 'Give or take 1\u00a0week' : `Give or take ${days}\u00a0day${days === 1 ? '' : 's'}`
}
