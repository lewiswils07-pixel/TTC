import { beforeEach, describe, expect, it } from 'vitest'
import { callouts, clearNotNow, forgetNotNow, mergeFeed, notNowIds, saveNotNow } from '../src/lib/feed'
import { tripDates } from '../src/lib/dates'
import type { InterestSuggestion, TripSuggestion } from '../src/lib/matching'

const person = { birth_year: 1962, home_city: 'Leeds', home_country: 'GB', photo_path: null, travelling_with: null }

const trip = (id: string, score: number, extra: Partial<TripSuggestion> = {}): TripSuggestion => ({
  ...person,
  profile_id: id,
  display_name: id,
  trip_city: 'Lisbon',
  trip_start: '2026-11-10',
  trip_end: '2026-11-20',
  overlap_start: '2026-11-12',
  overlap_end: '2026-11-18',
  shared_interests: ['Museums'],
  score,
  ...extra,
})

const interest = (id: string, score: number, extra: Partial<InterestSuggestion> = {}): InterestSuggestion => ({
  ...person,
  profile_id: id,
  display_name: id,
  distance_km: 200,
  shared_interests: ['Museums', 'Wine'],
  shared_places: [],
  score,
  ...extra,
})

describe('the For you feed', () => {
  it('lists each person once, people going where you are first', () => {
    const feed = mergeFeed([{ tripId: 7, people: [trip('Ann', 40)] }], [interest('Bob', 90), interest('Ann', 60), interest('Cat', 70)])
    expect(feed.map((p) => p.profile_id)).toEqual(['Ann', 'Bob', 'Cat'])
    expect(feed[0]).toMatchObject({ trip_id: 7, score: 60, shared_interests: ['Museums', 'Wine'] })
  })

  it('says why, strongest reason first', () => {
    const [ann] = mergeFeed([{ tripId: 7, people: [trip('Ann', 40)] }], [interest('Ann', 60, { shared_places: ['Rome'], shared_interests: ['Museums', 'Wine', 'Golf'] })])
    expect(callouts(ann, 'Leeds').map((c) => c.text)).toEqual([
      // Date ranges are spaced differently by different Node versions.
      `Also going to Lisbon, ${tripDates('2026-11-12', '2026-11-18')}`,
      'Similar interests',
      'Also from Leeds',
      'Also wants to visit Rome',
    ])
  })

  it('only says similar interests when there are 3 or more, and says when someone lives nearby', () => {
    const [bob] = mergeFeed([], [interest('Bob', 50, { shared_interests: ['Wine'], distance_km: 12, home_city: 'Otley' })])
    expect(callouts(bob, 'Leeds').map((c) => c.text)).toEqual(['Lives near you'])
  })
})

describe('Not now', () => {
  beforeEach(() => clearNotNow('me'))

  it('hides someone for 30 days, and can be undone', () => {
    const day = 86_400_000
    saveNotNow('me', 'Ann', 0)
    expect(notNowIds('me', 29 * day).has('Ann')).toBe(true)
    expect(notNowIds('me', 31 * day).has('Ann')).toBe(false)
    forgetNotNow('me', 'Ann')
    expect(notNowIds('me', day).size).toBe(0)
  })
})
