import { hasCard } from './card'
import { INTERESTS_TO_PICK } from './options'
import type { MyProfile } from './profile'

/** The profile steps, in order. Links and checks use these names, never the numbers. */
// The numbers are the order on screen: keep them in step with STEPS in routes/Onboarding.tsx.
export const STEP = { basics: 1, photo: 2, interests: 3, card: 4, travel: 5 } as const
export type StepName = keyof typeof STEP

/** The link that opens one profile step. */
export const stepLink = (name: StepName) => `/onboarding?step=${STEP[name]}`

/** Where to send a member who comes back to a half-finished profile. */
export function firstUnfinishedStep({ profile, interestIds, card }: MyProfile): number {
  if (!profile.display_name || !profile.birth_year || !profile.gender || !profile.home_city_id) return STEP.basics
  if (interestIds.length < INTERESTS_TO_PICK) return profile.photo_path || profile.bio ? STEP.interests : STEP.photo
  // Then the back of the card (once it's live); "How you travel" is optional, later.
  if (card && !hasCard(card)) return STEP.card
  return STEP.interests
}
