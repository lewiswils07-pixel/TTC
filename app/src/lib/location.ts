// "Use my location": the phone's position, used only to work out distances.
// The database keeps it private and sets the nearest town as the home city.
import type { City } from './cities'
import { FriendlyError, friendlyError } from './errors'
import { supabase } from './supabase'

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new FriendlyError('This device can’t share its location. Please type your city instead.'))
    navigator.geolocation.getCurrentPosition(resolve, (err) =>
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

/** Finds the member, saves the spot privately, and returns the nearest town. */
export async function locateMe(): Promise<City> {
  const { coords } = await position()
  const { data, error } = await supabase.rpc('set_my_location', { p_lat: coords.latitude, p_lng: coords.longitude }).single<City>()
  if (error || !data) throw friendlyError(error)
  return data
}

/** Forgets the saved spot, when the member picks a city by hand instead. */
export async function clearMyLocation(userId: string): Promise<void> {
  await supabase.from('member_locations').delete().eq('profile_id', userId)
}
