import { MIN_INTERESTS } from './options'
import type { MyProfile } from './profile'

/** Where to send a member who comes back to a half-finished profile. */
export function firstUnfinishedStep({ profile, interestIds }: MyProfile): number {
  if (!profile.display_name || !profile.birth_year || !profile.gender || !profile.home_city_id) return 1
  if (interestIds.length < MIN_INTERESTS) return profile.photo_path || profile.bio ? 3 : 2
  // Sign-up ends on the interests step; "How you travel" is optional, later.
  return 3
}
