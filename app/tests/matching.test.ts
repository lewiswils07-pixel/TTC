import { describe, expect, it } from 'vitest'
import { interestReasons, listLabels, reasons, type InterestSuggestion, type TripSuggestion } from '../src/lib/matching'

const base: TripSuggestion = {
  profile_id: 'x',
  display_name: 'Bob',
  birth_year: 1962,
  home_city: 'Leeds',
  home_country: 'GB',
  photo_path: null,
  trip_city: 'Lisbon',
  trip_start: '2026-11-14',
  trip_end: '2026-11-20',
  overlap_start: '2026-11-16',
  overlap_end: '2026-11-20',
  shared_interests: ['Museums', 'Theatre', 'Local cuisine', 'Photography'],
  score: 80,
}

describe('why we suggested someone', () => {
  it('names up to two shared interests', () => {
    expect(listLabels(['Museums'])).toBe('Museums')
    expect(listLabels(['Museums', 'Theatre'])).toBe('Museums and Theatre')
    expect(listLabels(['Museums', 'Theatre', 'Wine', 'Golf'])).toBe('Museums, Theatre and 2 more')
  })
  it('says when you overlap', () => {
    expect(reasons(base, 'Lisbon')).toEqual(['Both into Museums, Theatre and 2 more', expect.stringMatching(/^There at the same time: 16\s?–\s?20 Nov 2026$/)])
  })
  it('mentions a nearby town and flexible dates', () => {
    const lines = reasons({ ...base, trip_city: 'Cascais', overlap_start: null, overlap_end: null, shared_interests: [] }, 'Lisbon')
    expect(lines).toEqual([expect.stringMatching(/^Dates close to yours in Cascais: 14\s?–\s?20 Nov 2026$/)])
  })
})

describe('why we suggested someone with no trip in common', () => {
  const person: InterestSuggestion = {
    profile_id: 'y',
    display_name: 'Cat',
    birth_year: 1960,
    home_city: 'York',
    home_country: 'GB',
    photo_path: null,
    distance_km: 37,
    shared_interests: ['Museums', 'Theatre'],
    shared_places: ['Kyoto'],
    score: 60,
  }
  it('names interests, places and roughly how far away', () => {
    expect(interestReasons(person)).toEqual(['Both into Museums and Theatre', 'You both want to visit Kyoto', 'Lives about 35 km from you'])
  })
  it('says "near you" for the same town and leaves out places when none are shared', () => {
    expect(interestReasons({ ...person, distance_km: 0, shared_places: [] })).toEqual(['Both into Museums and Theatre', 'Lives near you'])
  })
})
