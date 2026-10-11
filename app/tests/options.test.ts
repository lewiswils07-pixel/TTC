import { describe, expect, it } from 'vitest'
import { cityLabel } from '../src/lib/cities'
import { DISTANCE_MILES, GENDERS, ageFromDate, ageLabel, distanceLabel, distanceStop, labelFor, latestBirthYear, milesToKm } from '../src/lib/options'
import { firstUnfinishedStep } from '../src/lib/onboarding'
import type { MyProfile, Profile } from '../src/lib/profile'

const emptyProfile: Profile = {
  id: 'u1',
  display_name: null,
  birth_year: null,
  birth_date: null,
  gender: null,
  home_city_id: null,
  bio: null,
  photo_path: null,
  travel_style: null,
  pace: null,
  budget: null,
  mobility_note: null,
  travelling_with: null,
  room_sharing: null,
  day_rhythm: null,
  walking: null,
  languages: [],
  onboarded_at: null,
  member_number: null,
  home_city: null,
}
const prefs = { age_min: 18, age_max: 99, genders: [], max_distance_km: null }
const make = (p: Partial<Profile>, interestIds: number[] = [], card: MyProfile['card'] = null): MyProfile => ({
  profile: { ...emptyProfile, ...p },
  interestIds,
  preferences: prefs,
  card,
  more: null,
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
    expect(firstUnfinishedStep(make(basics, [1, 2, 3, 4, 5, 6, 7, 8]))).toBe(3)
  })
})

describe('distance slider', () => {
  it('goes up by 1 to 50, by 5 to 100, then by 10 to 150 miles', () => {
    expect(DISTANCE_MILES[0]).toBe(1)
    expect(DISTANCE_MILES.slice(48, 52)).toEqual([49, 50, 55, 60])
    expect(DISTANCE_MILES.slice(-7)).toEqual([95, 100, 110, 120, 130, 140, 150])
    expect(DISTANCE_MILES.at(-1)).toBe(150)
  })
  it('shows a saved distance at its nearest stop', () => {
    expect(distanceLabel(milesToKm(1))).toBe('Up to 1 mile')
    expect(distanceLabel(milesToKm(37))).toBe('Up to 37 miles')
    // Old saved distances past 150 miles show at the end.
    expect(distanceLabel(milesToKm(300))).toBe('Up to 150 miles')
  })
  it('saves no limit as any distance', () => {
    expect(distanceLabel(null)).toBe('Any distance')
    expect(distanceStop(null)).toBe(DISTANCE_MILES.length - 1)
  })
})
