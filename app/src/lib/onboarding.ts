import { INTERESTS_MIN } from './options'
import type { MyProfile } from './profile'

/** The profile steps, in order. Links and checks use these names, never the numbers. */
// The numbers are the screens, in order: keep them in step with STEPS in routes/Onboarding.tsx.
// Three screens, as in Lewis's Claude Design (15 Oct): about you (with photo), how you travel (with interests), wish list (with the card).
export const STEP = { basics: 1, photo: 1, interests: 2, travel: 2, wishlist: 3, card: 3 } as const
export type StepName = keyof typeof STEP

/** The link that opens one profile step. */
/** A sign-up step to open from elsewhere; `returnTo` brings them back there once it's saved. */
export const stepLink = (name: StepName, returnTo?: string) => `/onboarding?step=${STEP[name]}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ''}`

/** Where to send a member who comes back to a half-finished profile. */
export function firstUnfinishedStep({ profile, interestIds }: MyProfile): number {
  if (!profile.display_name || !profile.birth_year || !profile.gender || !profile.home_city_id) return STEP.basics
  if (interestIds.length < INTERESTS_MIN) return STEP.interests
  return STEP.wishlist
}
