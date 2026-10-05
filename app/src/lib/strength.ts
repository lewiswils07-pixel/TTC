// How complete a profile is, and what to add next (sign-up review item 14).
// Each part makes suggestions work better or helps others say yes.
import type { Profile } from './profile'

export type StrengthPart = { label: string; done: boolean; to: string }

export function profileStrength(p: Profile, interestCount: number, hasTrip: boolean): { percent: number; parts: StrengthPart[] } {
  const parts: StrengthPart[] = [
    { label: 'Add a photo', done: !!p.photo_path, to: '/onboarding?step=2' },
    { label: 'Write a few words about you', done: !!p.bio, to: '/onboarding?step=2' },
    { label: 'Pick 5 or more interests', done: interestCount >= 5, to: '/onboarding?step=3' },
    { label: 'Say how you travel', done: !!(p.travel_style && p.pace && p.budget), to: '/onboarding?step=4' },
    { label: 'Answer the “On the road” questions', done: !!(p.room_sharing && p.day_rhythm && p.walking && p.languages.length), to: '/onboarding?step=4' },
    { label: 'Add a trip', done: hasTrip, to: '/trips/new' },
  ]
  const percent = Math.round((parts.filter((x) => x.done).length / parts.length) * 100)
  return { percent, parts }
}
