// Fixed answer lists for the profile. The values must match the CHECK
// constraints in supabase/migrations/*_identity_profiles.sql.

export type Option<T extends string> = { value: T; label: string }

export const GENDERS = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'nonbinary', label: 'Non-binary' },
] as const satisfies readonly Option<string>[]

// Travel style, pace and budget are each in order, so "next to each other"
// counts as a partial match in matching (spec §4.2).
export const TRAVEL_STYLES = [
  { value: 'planner', label: 'I like a plan' },
  { value: 'mix', label: 'A bit of both' },
  { value: 'spontaneous', label: 'Go with the flow' },
] as const satisfies readonly Option<string>[]

export const PACES = [
  { value: 'slow', label: 'Slow and easy' },
  { value: 'steady', label: 'Steady' },
  { value: 'packed', label: 'Pack it all in' },
] as const satisfies readonly Option<string>[]

export const BUDGETS = [
  { value: 'budget', label: 'Watching the pennies' },
  { value: 'mid', label: 'Mid-range' },
  { value: 'comfort', label: 'Treat ourselves' },
] as const satisfies readonly Option<string>[]

export type Gender = (typeof GENDERS)[number]['value']
export type TravelStyle = (typeof TRAVEL_STYLES)[number]['value']
export type Pace = (typeof PACES)[number]['value']
export type Budget = (typeof BUDGETS)[number]['value']

export const MIN_AGE = 18
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
