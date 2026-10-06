// How complete a profile is, and what to add next (sign-up review item 14).
// Each part makes suggestions work better or helps others say yes.
import { hasCard, type Card } from './card'
import { INTERESTS_TO_PICK } from './options'
import { stepLink } from './onboarding'
import type { Profile } from './profile'

export type StrengthPart = { label: string; done: boolean; to: string }

/** `card` is null until the back of the card is live in the database, and then counts as a part. */
export function profileStrength(p: Profile, interestCount: number, hasTrip: boolean, card: Card | null = null): { percent: number; parts: StrengthPart[] } {
  const parts: StrengthPart[] = [
    { label: 'Add a photo', done: !!p.photo_path, to: stepLink('photo') },
    { label: 'Write a few words about you', done: !!p.bio, to: stepLink('photo') },
    { label: `Pick your top ${INTERESTS_TO_PICK} interests`, done: interestCount === INTERESTS_TO_PICK, to: stepLink('interests') },
    ...(card ? [{ label: 'Fill in the back of your card', done: hasCard(card), to: stepLink('card') }] : []),
    { label: 'Say how you travel', done: !!(p.travel_style && p.pace && p.budget), to: stepLink('travel') },
    { label: 'Answer the “On the road” questions', done: !!(p.room_sharing && p.day_rhythm && p.walking && p.languages.length), to: stepLink('travel') },
    { label: 'Add a trip', done: hasTrip, to: '/trips/new' },
  ]
  const percent = Math.round((parts.filter((x) => x.done).length / parts.length) * 100)
  return { percent, parts }
}
