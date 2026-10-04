// Field checks shared by the forms. Each returns a message a member can act
// on, or null when the value is fine. The database repeats the important
// rules, so these are for helpful, instant feedback only.
import { CODE_LENGTH, isValidEmail } from './auth'
import { MAX_PREF_AGE, MIN_AGE, MIN_INTERESTS, latestBirthYear } from './options'

export type Check<T> = (value: T) => string | null

export const checkEmail: Check<string> = (v) => {
  if (!v.trim()) return 'Please enter your email address.'
  return isValidEmail(v) ? null : 'That doesn’t look like an email address. Check for typos, for example jane@example.com.'
}

export const checkCode: Check<string> = (v) => {
  const digits = v.replace(/\D/g, '')
  if (!digits) return `Please enter the ${CODE_LENGTH}-digit code from the email.`
  if (/[^\d\s]/.test(v)) return 'The code only has numbers in it.'
  return digits.length === CODE_LENGTH ? null : `The code has ${CODE_LENGTH} digits. You’ve typed ${digits.length}.`
}

export const checkName: Check<string> = (v) => {
  const name = v.trim()
  if (!name) return 'Please tell us your first name.'
  if (name.length > 40) return 'Please keep your name to 40 characters or fewer.'
  if (/\d/.test(name)) return 'Names can’t include numbers.'
  return null
}

export function checkBirthYear(v: string, now = new Date()): string | null {
  if (!v) return 'Please enter the year you were born, for example 1965.'
  if (!/^\d{4}$/.test(v)) return 'Please enter all four digits of the year, for example 1965.'
  const year = Number(v)
  if (year < 1900) return 'Please check the year: it looks too early.'
  if (year > latestBirthYear(now)) return `You need to be ${MIN_AGE} or over to join.`
  return null
}

export const checkChosen = (what: string): Check<readonly unknown[]> => (v) => (v.length ? null : `Please choose ${what}.`)

export const checkInterests: Check<readonly unknown[]> = (v) =>
  v.length >= MIN_INTERESTS ? null : `Pick at least ${MIN_INTERESTS} interests. You’ve picked ${v.length}.`

export function checkAgeRange([min, max]: readonly [number, number]): string | null {
  if (min < MIN_AGE || max > MAX_PREF_AGE || min > max) return `Choose ages between ${MIN_AGE} and ${MAX_PREF_AGE}.`
  return null
}
