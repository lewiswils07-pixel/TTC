// Fixed answer lists for the profile, with their wording. The values come
// from app/rules.json (`choices`), which the database checks against; a test
// fails if a list here doesn't match it.
import { rules } from './rules'

export type Option<T extends string> = { value: T; label: string; hint?: string }

export const GENDERS = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'genderfluid', label: 'Genderfluid' },
  { value: 'agender', label: 'Agender' },
  { value: 'another', label: 'Another identity' },
  { value: 'unsaid', label: 'Prefer not to say' },
] as const satisfies readonly Option<string>[]

/** Who members can choose to see. The third also shows genderfluid, agender
 *  and "another identity" members; "Prefer not to say" members are shown to
 *  those who pick all three (the database's fits_preferences does the same). */
export const SHOWN_GENDERS = [
  { value: 'woman', label: 'Women' },
  { value: 'man', label: 'Men' },
  { value: 'nonbinary', label: 'Non-binary and other identities' },
] as const satisfies readonly Option<Gender>[]

// Travel style, pace and budget are each in order, so "next to each other"
// counts as a partial match in matching (spec §4.2).
export const TRAVEL_STYLES = [
  { value: 'planner', label: 'Planner', hint: 'I like to know the plan before I go.' },
  { value: 'mix', label: 'Bit of both', hint: 'A rough plan, with room for surprises.' },
  { value: 'spontaneous', label: 'Spontaneous', hint: 'I prefer to go with the flow.' },
] as const satisfies readonly Option<string>[]

export const PACES = [
  { value: 'slow', label: 'Relaxed', hint: 'One or two things a day, plenty of rest.' },
  { value: 'steady', label: 'Steady', hint: 'A good mix of sightseeing and downtime.' },
  { value: 'packed', label: 'Packed', hint: 'Up early, see as much as possible.' },
] as const satisfies readonly Option<string>[]

export const BUDGETS = [
  { value: 'budget', label: 'Budget', hint: 'Watching the pennies: hostels, guesthouses, picnics.' },
  { value: 'mid', label: 'Mid-range', hint: 'Comfortable hotels and nice meals out.' },
  { value: 'comfort', label: 'Comfort', hint: 'Treat ourselves: good hotels and fine dining.' },
] as const satisfies readonly Option<string>[]

// Everyday habits (matching v2). Also in order: a clash lowers a score a
// little but never hides anyone.
export const ROOM_SHARING = [
  { value: 'share', label: 'Happy to share', hint: 'Sharing a twin room is fine, and saves money.' },
  { value: 'unsure', label: 'Maybe', hint: 'It depends on the trip and the person.' },
  { value: 'separate', label: 'Own room', hint: 'I’d always want a room to myself.' },
] as const satisfies readonly Option<string>[]

export const DAY_RHYTHMS = [
  { value: 'early', label: 'Early riser' },
  { value: 'either', label: 'Either' },
  { value: 'late', label: 'Night owl' },
] as const satisfies readonly Option<string>[]

export const WALKING = [
  { value: 'gentle', label: 'Gentle', hint: 'Short walks with plenty of sit-downs.' },
  { value: 'moderate', label: 'Moderate', hint: 'A few hours on my feet is fine.' },
  { value: 'lots', label: 'Lots', hint: 'Happy walking all day.' },
] as const satisfies readonly Option<string>[]

// Codes are ISO 639-1; the database only checks they're 2 letters.
export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'el', label: 'Greek' },
  { value: 'pl', label: 'Polish' },
  { value: 'cy', label: 'Welsh' },
  { value: 'ga', label: 'Irish' },
  { value: 'sv', label: 'Swedish' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ur', label: 'Urdu' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
] as const satisfies readonly Option<string>[]
export const MAX_LANGUAGES = rules.profile.languagesMax

export type Gender = (typeof GENDERS)[number]['value']
export type TravelStyle = (typeof TRAVEL_STYLES)[number]['value']
export type Pace = (typeof PACES)[number]['value']
export type Budget = (typeof BUDGETS)[number]['value']
export type RoomSharing = (typeof ROOM_SHARING)[number]['value']
export type DayRhythm = (typeof DAY_RHYTHMS)[number]['value']
export type Walking = (typeof WALKING)[number]['value']

/** Stops on the distance slider, in miles; the last stop is "any distance". The database keeps km. */
export const DISTANCE_MILES = [5, 10, 25, 50, 75, 100, 150, 200, 300, null] as const
const KM_PER_MILE = 1.609344
export const milesToKm = (miles: number | null): number | null => (miles === null ? null : Math.round(miles * KM_PER_MILE))
/** The slider stop for a saved distance: the nearest one, or "any". */
export function distanceStop(km: number | null): number {
  if (km === null) return DISTANCE_MILES.length - 1
  let best = 0
  DISTANCE_MILES.forEach((m, i) => {
    if (m !== null && Math.abs(m * KM_PER_MILE - km) < Math.abs((DISTANCE_MILES[best] ?? 0) * KM_PER_MILE - km)) best = i
  })
  return best
}
export const distanceLabel = (miles: number | null) => (miles === null ? 'Any distance' : `Up to ${miles} miles`)

export const MIN_AGE = rules.age.min
export const MAX_PREF_AGE = rules.age.maxPreferred
// Everyone picks the same number (Lewis: 7 on 5 Oct, 8 from 6 Oct): a fixed
// number keeps profiles comparable and makes members choose what matters most.
export const INTERESTS_TO_PICK = rules.interests.pick

export function labelFor<T extends string>(options: readonly Option<T>[], value: T | null | undefined): string {
  return options.find((o) => o.value === value)?.label ?? 'Not set'
}

/** Latest birth year allowed today (the database checks the same rule). */
export function latestBirthYear(now = new Date()): number {
  return now.getFullYear() - MIN_AGE
}

/** The database sends "this year minus the member's exact age" (it never
 *  shares a date of birth), so this is their exact age. */
export function ageLabel(birthYear: number | null, now = new Date()): string {
  if (!birthYear) return 'Not set'
  return String(now.getFullYear() - birthYear)
}

/** Exact age from a YYYY-MM-DD date of birth. */
export function ageFromDate(date: string, now = new Date()): number {
  const [y, m, d] = date.split('-').map(Number)
  const had = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d)
  return now.getFullYear() - y - (had ? 0 : 1)
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
