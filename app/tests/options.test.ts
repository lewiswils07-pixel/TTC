import { describe, expect, it } from 'vitest'
import { cityLabel } from '../src/lib/cities'
import { GENDERS, ageFromDate, ageLabel, labelFor, latestBirthYear } from '../src/lib/options'
import { firstUnfinishedStep } from '../src/lib/onboarding'
import type { MyProfile, Profile } from '../src/lib/profile'

const emptyProfile: Profile = {
  id: 'u1', display_name: null, birth_year: null,
  birth_date: null, gender: null, home_city_id: null, bio: null, photo_path: null,
  travel_style: null, pace: null, budget: null, mobility_note: null,
  travelling_with: null,
  room_sharing: null,
  day_rhythm: null,
  walking: null,
  languages: [], onboarded_at: null,
  member_number: null, home_city: null,
}
const prefs = { age_min: 18, age_max: 99, genders: [], max_distance_km: null }
const make = (p: Partial<Profile>, interestIds: number[] = [], card: MyProfile['card'] = null): MyProfile => ({
  profile: { ...emptyProfile, ...p }, interestIds, preferences: prefs, card,
})
const basics = { display_name: 'Jo', birth_year: 1960, gender: 'woman', home_city_id: 1 } as const

describe('profile helpers', () => {
  it('needs members to be 18 by year of birth', () => {
    expect(latestBirthYear(new Date('2026-10-05'))).toBe(2008)
  })
  it('shows the exact age the database sends as "this year minus age"', () => {
    expect(ageLabel(1960, new Date('2026-10-05'))).toBe('66')
    expect(ageLabel(null)).toBe('Not set')
  })
  it('works out an exact age from a date of birth', () => {
    expect(ageFromDate('1960-10-05', new Date(2026, 9, 5))).toBe(66)
    expect(ageFromDate('1960-10-06', new Date(2026, 9, 5))).toBe(65)
    expect(ageFromDate('2008-02-29', new Date(2026, 1, 28))).toBe(17)
  })
  it('labels answers and unknowns', () => {
    expect(labelFor(GENDERS, 'nonbinary')).toBe('Non-binary')
    expect(labelFor(GENDERS, null)).toBe('Not set')
  })
  it('shows city with country name', () => {
    expect(cityLabel({ name: 'Lisbon', country_code: 'PT' })).toBe('Lisbon, Portugal')
    expect(cityLabel({ name: 'Leeds', country_code: 'GB' })).toBe('Leeds, United Kingdom')
  })
  it('resumes onboarding at the first unfinished step', () => {
    expect(firstUnfinishedStep(make({}))).toBe(1)
    expect(firstUnfinishedStep(make(basics))).toBe(2)
    expect(firstUnfinishedStep(make({ ...basics, bio: 'Hi' }))).toBe(3)
    expect(firstUnfinishedStep(make(basics, [1, 2, 3, 4, 5, 6, 7]))).toBe(3)
  })
})
