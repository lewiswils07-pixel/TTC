import { describe, expect, it } from 'vitest'
import { cityLabel } from '../src/lib/cities'
import { GENDERS, ageLabel, labelFor, latestBirthYear } from '../src/lib/options'
import { firstUnfinishedStep } from '../src/lib/onboarding'
import type { MyProfile, Profile } from '../src/lib/profile'

const emptyProfile: Profile = {
  id: 'u1', display_name: null, birth_year: null, gender: null, home_city_id: null, bio: null, photo_path: null,
  travel_style: null, pace: null, budget: null, mobility_note: null, onboarded_at: null, home_city: null,
}
const prefs = { age_min: 18, age_max: 99, genders: [], max_distance_km: null }
const make = (p: Partial<Profile>, interestIds: number[] = []): MyProfile => ({
  profile: { ...emptyProfile, ...p }, interestIds, preferences: prefs,
})
const basics = { display_name: 'Jo', birth_year: 1960, gender: 'woman', home_city_id: 1 } as const

describe('profile helpers', () => {
  it('needs members to be 18 by year of birth', () => {
    expect(latestBirthYear(new Date('2026-10-05'))).toBe(2008)
  })
  it('shows age as two possible numbers from the birth year', () => {
    expect(ageLabel(1960, new Date('2026-10-05'))).toBe('65 or 66')
    expect(ageLabel(null)).toBe('Not set')
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
    expect(firstUnfinishedStep(make(basics, [1, 2, 3]))).toBe(4)
  })
})
