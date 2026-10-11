// "Use my location": the phone's position, used only to work out distances.
// The database keeps it private and sets the nearest town as the home city.
import type { City } from './cities'
import type { Point } from './map'
import { FriendlyError, friendlyError } from './errors'
import { supabase } from './supabase'

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new FriendlyError('This device can’t share its location. Please type your city instead.'))
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) =>
        reject(
          new FriendlyError(
            err.code === err.PERMISSION_DENIED
              ? 'Location is turned off for this app. You can turn it on in your settings, or type your city instead.'
              : 'We couldn’t find where you are. Please try again, or type your city instead.',
          ),
        ),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 },
    )
  })
}

/** Saves a spot privately and returns the nearest town, which becomes the home city. */
export async function placeMe(spot: Point): Promise<City> {
  const { data, error } = await supabase.rpc('set_my_location', { p_lat: spot.lat, p_lng: spot.lng }).single<City>()
  if (error || !data) throw friendlyError(error)
  return data
}

/** Asks the phone where the member is (it asks for permission the first time). */
export async function findMe(): Promise<Point> {
  const { coords } = await position()
  return { lat: coords.latitude, lng: coords.longitude }
}

/** Forgets the saved spot, when the member picks a city by hand instead. */
export async function clearMyLocation(userId: string): Promise<void> {
  await supabase.from('member_locations').delete().eq('profile_id', userId)
}
