// Fixed answer lists for the profile. The values must match the CHECK
// constraints in supabase/migrations/*_identity_profiles.sql.

export type Option<T extends string> = { value: T; label: string; hint?: string }

export const GENDERS = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'nonbinary', label: 'Non-binary' },
] as const satisfies readonly Option<string>[]

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

export type Gender = (typeof GENDERS)[number]['value']
export type TravelStyle = (typeof TRAVEL_STYLES)[number]['value']
export type Pace = (typeof PACES)[number]['value']
export type Budget = (typeof BUDGETS)[number]['value']

export const DISTANCES = [
  { value: 'any', label: 'Any' },
  { value: '50', label: '50 km' },
  { value: '150', label: '150 km' },
  { value: '500', label: '500 km' },
] as const
export type Distance = (typeof DISTANCES)[number]['value']
export const distanceOption = (km: number | null): Distance => DISTANCES.find((d) => d.value === String(km))?.value ?? 'any'
export const distanceKm = (d: Distance | undefined): number | null => (!d || d === 'any' ? null : Number(d))

export const MIN_AGE = 18
export const MAX_PREF_AGE = 99
export const MIN_INTERESTS = 3
export const MAX_INTERESTS = 10

export function labelFor<T extends string>(options: readonly Option<T>[], value: T | null | undefined): string {
  return options.find((o) => o.value === value)?.label ?? 'Not set'
}

/** Latest birth year allowed today (the database checks the same rule). */
export function latestBirthYear(now = new Date()): number {
  return now.getFullYear() - MIN_AGE
}

/** We only store the birth year, so the age is one of two numbers. */
export function ageLabel(birthYear: number | null, now = new Date()): string {
  if (!birthYear) return 'Not set'
  const age = now.getFullYear() - birthYear
  return `${age - 1} or ${age}`
}
