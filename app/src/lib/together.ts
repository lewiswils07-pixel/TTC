// Plan a trip together (Lewis, 7 Oct): invite a connection to one of your
// trips, or a new place and dates. It's a two-person group underneath, with
// its own chat and plan board, so more people can join later. When they
// accept, the trip is added to their trips too.
import { friendlyError } from './errors'
import { supabase } from './supabase'

export type TripTogether = {
  group_id: number
  name: string
  city: string
  country_code: string
  start_date: string
  end_date: string
  my_status: 'invited' | 'joined'
  their_status: 'invited' | 'joined'
  i_own: boolean
  is_pair: boolean
  conversation_id: number | null
}

/** Sends the invite (it also appears in your chat). Returns the trip's group. */
export async function planTripTogether(
  withId: string,
  trip: { tripId: number } | { cityId: number; start: string; end: string },
): Promise<number> {
  const { data, error } = await supabase.rpc(
    'plan_trip_together',
    'tripId' in trip
      ? { p_with: withId, p_trip_id: trip.tripId }
      : { p_with: withId, p_city_id: trip.cityId, p_start: trip.start, p_end: trip.end },
  )
  if (error) throw friendlyError(error)
  return data as number
}

/** Trips you're planning (or invited to plan) with this member. Empty on a database without them yet. */
export async function tripsTogether(profileId: string): Promise<TripTogether[]> {
  const { data, error } = await supabase.rpc('trips_together', { p_profile: profileId })
  if (error) return []
  return (data ?? []) as TripTogether[]
}
