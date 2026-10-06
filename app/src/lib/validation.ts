// Field checks shared by the forms. Each returns a message a member can act
// on, or null when the value is fine. The database repeats the important
// rules, so these are for helpful, instant feedback only.
import { CODE_LENGTH, isValidEmail, MAX_PASSWORD, MIN_PASSWORD } from './auth'
import { addDays, daysBetween } from './dates'
import { INTERESTS_TO_PICK, MAX_PREF_AGE, MIN_AGE, ageFromDate, latestBirthYear } from './options'

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

/** A new password. */
export const checkNewPassword: Check<string> = (v) => {
  if (!v) return 'Please choose a password.'
  if (v.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters. You’ve typed ${v.length}.`
  if (v.length > MAX_PASSWORD) return `Please keep it to ${MAX_PASSWORD} characters or fewer.`
  if (v.trim() !== v) return 'Your password can’t start or end with a space.'
  return null
}

/** A password typed to sign in. */
export const checkPassword: Check<string> = (v) => (v ? null : 'Please enter your password.')

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

/** Day, month (1-12) and year as typed; returns YYYY-MM-DD when valid. */
export function birthDate(day: string, month: string, year: string): string | null {
  if (!day || !month || !/^\d{4}$/.test(year)) return null
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (d.getUTCDate() !== Number(day)) return null
  return d.toISOString().slice(0, 10)
}

export function checkBirthDate(day: string, month: string, year: string, now = new Date()): string | null {
  if (!day && !month && !year) return 'Please enter your date of birth.'
  if (!day || !month) return 'Please choose the day and month.'
  // Too young is decided by the full date below, not the year.
  const yearError = checkBirthYear(year, now)
  if (yearError && !(/^\d{4}$/.test(year) && Number(year) > latestBirthYear(now))) return yearError
  const date = birthDate(day, month, year)
  if (!date) return 'That date doesn’t exist. Please check the day and month.'
  if (ageFromDate(date, now) < MIN_AGE) return `You need to be ${MIN_AGE} or over to join.`
  return null
}

export const checkChosen = (what: string): Check<readonly unknown[]> => (v) => (v.length ? null : `Please choose ${what}.`)

export const checkInterests: Check<readonly unknown[]> = (v) =>
  v.length === INTERESTS_TO_PICK
    ? null
    : v.length < INTERESTS_TO_PICK
      ? `Pick ${INTERESTS_TO_PICK} interests. You’ve picked ${v.length}, so ${INTERESTS_TO_PICK - v.length} more to go.`
      : `Pick ${INTERESTS_TO_PICK} interests. You’ve picked ${v.length}, so remove ${v.length - INTERESTS_TO_PICK}.`

export function checkAgeRange([min, max]: readonly [number, number]): string | null {
  if (min < MIN_AGE || max > MAX_PREF_AGE || min > max) return `Choose ages between ${MIN_AGE} and ${MAX_PREF_AGE}.`
  return null
}

export const MAX_TRIP_DAYS = 91
export const MAX_NOTE = 280

/** Errors for a trip's first and last day. `today` is YYYY-MM-DD. */
export function checkTripDates(start: string, end: string, today: string): { start: string | null; end: string | null } {
  let startError: string | null = null
  let endError: string | null = null
  if (!start) startError = 'Please choose your first day.'
  else if (start > addDays(today, 730)) startError = 'Trips can be up to 2 years ahead.'
  if (!end) endError = 'Please choose your last day.'
  else if (end < today) endError = 'This date has passed. Please choose a future date.'
  else if (start && end < start) endError = 'Your last day needs to be on or after your first day.'
  else if (start && daysBetween(start, end) + 1 > MAX_TRIP_DAYS) endError = 'Trips can be up to 3 months long.'
  return { start: startError, end: endError }
}

export const checkNote: Check<string> = (v) => (v.length > MAX_NOTE ? `Please keep this to ${MAX_NOTE} characters or fewer.` : null)
