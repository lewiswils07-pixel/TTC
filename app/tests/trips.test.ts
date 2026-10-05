import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, isoDate, tripDates } from '../src/lib/dates'
import { checkNote, checkTripDates } from '../src/lib/validation'

const today = '2026-10-05'

describe('trip dates', () => {
  it('asks for both days', () => {
    expect(checkTripDates('', '', today)).toEqual({ start: 'Please choose your first day.', end: 'Please choose your last day.' })
  })
  it('accepts a normal trip, including a one-day trip', () => {
    expect(checkTripDates('2026-11-01', '2026-11-08', today)).toEqual({ start: null, end: null })
    expect(checkTripDates(today, today, today)).toEqual({ start: null, end: null })
  })
  it('flags a last day before the first', () => {
    expect(checkTripDates('2026-11-08', '2026-11-01', today).end).toMatch(/on or after your first day/)
  })
  it('flags trips that have ended', () => {
    expect(checkTripDates('2026-09-01', '2026-09-08', today).end).toMatch(/has passed/)
  })
  it('allows up to 3 months', () => {
    expect(checkTripDates('2026-11-01', addDays('2026-11-01', 90), today).end).toBeNull()
    expect(checkTripDates('2026-11-01', addDays('2026-11-01', 91), today).end).toMatch(/3 months/)
  })
  it('allows up to 2 years ahead', () => {
    expect(checkTripDates(addDays(today, 730), addDays(today, 731), today).start).toBeNull()
    expect(checkTripDates(addDays(today, 731), addDays(today, 732), today).start).toMatch(/2 years/)
  })
  it('limits the note', () => {
    expect(checkNote('x'.repeat(280))).toBeNull()
    expect(checkNote('x'.repeat(281))).toMatch(/280/)
  })
})

describe('date helpers', () => {
  it('works in calendar days', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDays('2027-03-27', 2)).toBe('2027-03-29')
    expect(daysBetween('2026-10-25', '2026-10-26')).toBe(1)
    expect(isoDate(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
  it('reads ranges the British way', () => {
    expect(tripDates('2026-10-12', '2026-10-19')).toMatch(/^12\s?–\s?19 Oct 2026$/)
    expect(tripDates('2026-10-28', '2026-11-03')).toMatch(/^28 Oct\s?–\s?3 Nov 2026$/)
  })
})
