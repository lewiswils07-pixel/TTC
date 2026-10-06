import { hasCard } from './card'
import { INTERESTS_TO_PICK } from './options'
import type { MyProfile } from './profile'

/** Where to send a member who comes back to a half-finished profile. */
export function firstUnfinishedStep({ profile, interestIds, card }: MyProfile): number {
  if (!profile.display_name || !profile.birth_year || !profile.gender || !profile.home_city_id) return 1
  if (interestIds.length < INTERESTS_TO_PICK) return profile.photo_path || profile.bio ? 3 : 2
  // Then the back of the card (once it's live); "How you travel" is optional, later.
  if (card && !hasCard(card)) return 4
  return 3
}
