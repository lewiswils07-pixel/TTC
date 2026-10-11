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

// Your travel style (Lewis, 11 Oct): each list is in order, so close answers
// count as a partial match. Together they're 30 of the 100 matching points.
export const TRAVEL_STYLES = [
  { value: 'planner', label: 'Plan every detail' },
  { value: 'mix', label: 'Rough plan' },
  { value: 'spontaneous', label: 'Spontaneous' },
] as const satisfies readonly Option<string>[]

export const PACES = [
  { value: 'easy', label: 'Take it easy', hint: 'Lots of rest, very little planned.' },
  { value: 'slow', label: 'Relaxed', hint: 'One or two things a day, plenty of rest.' },
  { value: 'steady', label: 'Steady', hint: 'A good mix of sightseeing and downtime.' },
  { value: 'busy', label: 'Busy', hint: 'Out most of the day, with a break or two.' },
  { value: 'packed', label: 'Packed', hint: 'Up early, see as much as possible.' },
] as const satisfies readonly Option<string>[]

export const BUDGETS = [
  { value: 'budget', label: 'Budget', hint: 'Watching the pennies: guesthouses and simple meals.' },
  { value: 'comfort', label: 'Comfort', hint: 'Comfortable hotels and nice meals out.' },
  { value: 'luxury', label: 'Luxury', hint: 'Five stars, first class, the works.' },
] as const satisfies readonly Option<string>[]

export const MOVING = [
  { value: 'base', label: 'One base' },
  { value: 'few', label: 'A few stops' },
  { value: 'move', label: 'Always on the move' },
] as const satisfies readonly Option<string>[]

export const TRAVEL_OFTEN = [
  { value: 'once', label: 'Once a year' },
  { value: 'twice', label: 'Twice a year' },
  { value: 'few', label: '2–4 times a year' },
  { value: 'many', label: '5 or more a year' },
] as const satisfies readonly Option<string>[]

export const BOOKING = [
  { value: 'ahead', label: 'Months ahead' },
  { value: 'weeks', label: 'A few weeks ahead' },
  { value: 'last', label: 'Last minute' },
] as const satisfies readonly Option<string>[]

export const GROUP_SIZES = [
  { value: 'two', label: 'Two is plenty' },
  { value: 'small', label: 'A small group' },
  { value: 'more', label: 'The more the merrier' },
] as const satisfies readonly Option<string>[]

/** Every "Your travel style" question, in the order they're asked. */
export const STYLE_QUESTIONS = [
  { key: 'pace', label: 'Pace', options: PACES, filter: 'paces' },
  { key: 'budget', label: 'Budget', options: BUDGETS, filter: 'budgets' },
  { key: 'travel_style', label: 'Planning', options: TRAVEL_STYLES, filter: 'styles' },
  { key: 'moving', label: 'Moving around', options: MOVING, filter: 'movings' },
  { key: 'travel_often', label: 'How often you travel', options: TRAVEL_OFTEN, filter: 'travel_oftens' },
  { key: 'booking', label: 'Booking', options: BOOKING, filter: 'bookings' },
  { key: 'group_size', label: 'Group size', options: GROUP_SIZES, filter: 'group_sizes' },
] as const

// About you: one answer each (they rarely change from trip to trip).
export const DRINKING = [
  { value: 'none', label: 'Don’t drink' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'socially', label: 'Socially' },
  { value: 'often', label: 'Most evenings' },
] as const satisfies readonly Option<string>[]

export const SMOKING = [
  { value: 'no', label: 'Non-smoker' },
  { value: 'social', label: 'Social smoker' },
  { value: 'yes', label: 'Smoker' },
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
  // Added after testers (7 Oct): no Gujarati, among others.
  { value: 'gu', label: 'Gujarati' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ta', label: 'Tamil' },
  { value: 'tr', label: 'Turkish' },
  { value: 'ru', label: 'Russian' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'ro', label: 'Romanian' },
  { value: 'cs', label: 'Czech' },
  { value: 'hu', label: 'Hungarian' },
  { value: 'da', label: 'Danish' },
  { value: 'no', label: 'Norwegian' },
  { value: 'fi', label: 'Finnish' },
  { value: 'gd', label: 'Scottish Gaelic' },
  { value: 'he', label: 'Hebrew' },
  { value: 'fa', label: 'Persian' },
  { value: 'ko', label: 'Korean' },
  { value: 'th', label: 'Thai' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'tl', label: 'Tagalog' },
  { value: 'sw', label: 'Swahili' },
] as const satisfies readonly Option<string>[]

/** Food preferences (rules.choices.diet), so nobody has to explain at dinner. */
export const DIETS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'gluten-free', label: 'Gluten-free' },
  { value: 'dairy-free', label: 'Dairy-free' },
] as const satisfies readonly Option<string>[]
export const MAX_LANGUAGES = rules.profile.languagesMax

// More about you (Lewis, 11 Oct): all optional, and hidden unless the member
// chooses to show them on their profile.
export const SEXUALITIES = [
  { value: 'straight', label: 'Straight' },
  { value: 'gay', label: 'Gay' },
  { value: 'lesbian', label: 'Lesbian' },
  { value: 'bisexual', label: 'Bisexual' },
  { value: 'pansexual', label: 'Pansexual' },
  { value: 'asexual', label: 'Asexual' },
  { value: 'demisexual', label: 'Demisexual' },
  { value: 'queer', label: 'Queer' },
  { value: 'questioning', label: 'Questioning' },
  { value: 'another', label: 'Another sexuality' },
] as const satisfies readonly Option<string>[]

export const RELIGIONS = [
  { value: 'agnostic', label: 'Agnostic' },
  { value: 'atheist', label: 'Atheist' },
  { value: 'buddhist', label: 'Buddhist' },
  { value: 'catholic', label: 'Catholic' },
  { value: 'christian', label: 'Christian' },
  { value: 'hindu', label: 'Hindu' },
  { value: 'jewish', label: 'Jewish' },
  { value: 'muslim', label: 'Muslim' },
  { value: 'sikh', label: 'Sikh' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'another', label: 'Another religion' },
] as const satisfies readonly Option<string>[]

export const ETHNICITIES = [
  { value: 'black', label: 'Black or African descent' },
  { value: 'east_asian', label: 'East Asian' },
  { value: 'hispanic', label: 'Hispanic or Latino' },
  { value: 'middle_eastern', label: 'Middle Eastern' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'pacific_islander', label: 'Pacific Islander' },
  { value: 'south_asian', label: 'South Asian' },
  { value: 'southeast_asian', label: 'Southeast Asian' },
  { value: 'white', label: 'White' },
  { value: 'another', label: 'Another ethnicity' },
] as const satisfies readonly Option<string>[]

export type PersonalField = 'sexuality' | 'religion' | 'ethnicity'
export const PERSONAL_FIELDS: readonly { key: PersonalField; label: string; options: readonly Option<string>[] }[] = [
  { key: 'sexuality', label: 'Sexuality', options: SEXUALITIES },
  { key: 'religion', label: 'Religion', options: RELIGIONS },
  { key: 'ethnicity', label: 'Ethnicity', options: ETHNICITIES },
]

/** Holiday preferences (Lewis, 11 Oct): pick as many as apply, since trips
 *  vary. Not used for matching; seeing other people's is a Sodalis+ feature. */
export const HOLIDAY_QUESTIONS = [
  {
    key: 'stay',
    label: 'Where I stay',
    filter: 'stays',
    options: [
      { value: 'hotel', label: 'Hotel' },
      { value: 'apartment', label: 'Apartment' },
      { value: 'bnb', label: 'B&B' },
      { value: 'resort', label: 'All-inclusive' },
      { value: 'hostel', label: 'Hostel' },
      { value: 'camping', label: 'Camping' },
    ],
  },
  {
    key: 'length',
    label: 'Trip length',
    filter: 'lengths',
    options: [
      { value: 'weekend', label: 'Long weekend' },
      { value: 'week', label: 'A week' },
      { value: 'fortnight', label: 'Two weeks' },
      { value: 'longer', label: 'Longer' },
    ],
  },
  {
    key: 'season',
    label: 'Favourite season',
    filter: 'seasons',
    options: [
      { value: 'spring', label: 'Spring' },
      { value: 'summer', label: 'Summer' },
      { value: 'autumn', label: 'Autumn' },
      { value: 'winter', label: 'Winter' },
    ],
  },
] as const satisfies readonly { key: string; label: string; filter: string; options: readonly Option<string>[] }[]
export type HolidayPrefs = Partial<Record<(typeof HOLIDAY_QUESTIONS)[number]['key'], string[]>>

/** "I’m interested in" (Lewis, 11 Oct, like Hinge): Men, Women, Non-binary people, or Everyone. */
export const INTERESTED_IN = [
  { value: 'man', label: 'Men' },
  { value: 'woman', label: 'Women' },
  { value: 'nonbinary', label: 'Non-binary people' },
] as const satisfies readonly Option<Gender>[]
export const PHOTO_BOOK_MAX = rules.profile.photoBookMax

export type Gender = (typeof GENDERS)[number]['value']
export type TravelStyle = (typeof TRAVEL_STYLES)[number]['value']
export type Pace = (typeof PACES)[number]['value']
export type Budget = (typeof BUDGETS)[number]['value']
export type Moving = (typeof MOVING)[number]['value']
export type TravelOften = (typeof TRAVEL_OFTEN)[number]['value']
export type Booking = (typeof BOOKING)[number]['value']
export type GroupSize = (typeof GROUP_SIZES)[number]['value']
export type RoomSharing = (typeof ROOM_SHARING)[number]['value']
export type DayRhythm = (typeof DAY_RHYTHMS)[number]['value']
export type Walking = (typeof WALKING)[number]['value']

// The distance slider (Lewis, 11 Oct, like Hinge): a mile at a time up to 50,
// then 5 at a time up to 100, then 10 at a time up to 150. Further than that
// is the "Show people further away too" box, saved as no limit.
const steps = (from: number, to: number, by: number) => Array.from({ length: (to - from) / by + 1 }, (_, i) => from + i * by)
export const DISTANCE_MILES: readonly number[] = [...steps(1, 50, 1), ...steps(55, 100, 5), ...steps(110, 150, 10)]
const KM_PER_MILE = 1.609344
export const milesToKm = (miles: number): number => Math.max(1, Math.round(miles * KM_PER_MILE))
/** The slider stop for a saved distance: the nearest one, or the last for no limit. */
export function distanceStop(km: number | null): number {
  if (km === null) return DISTANCE_MILES.length - 1
  let best = 0
  DISTANCE_MILES.forEach((m, i) => {
    if (Math.abs(m * KM_PER_MILE - km) < Math.abs(DISTANCE_MILES[best] * KM_PER_MILE - km)) best = i
  })
  return best
}
const milesText = (miles: number) => (miles === 1 ? '1 mile' : `${miles} miles`)
export const distanceLabel = (km: number | null) => (km === null ? 'Any distance' : `Up to ${milesText(DISTANCE_MILES[distanceStop(km)])}`)

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
