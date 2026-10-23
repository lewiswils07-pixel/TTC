import { beforeEach, describe, expect, it } from 'vitest'
import { bestDays } from '../src/lib/overlap'
import { callouts, clearNotNow, forgetNotNow, groupByTrip, mergeFeed, nearYou, notNowIds, saveNotNow, tripTo, whatYouShare } from '../src/lib/feed'
import { shortDates } from '../src/lib/dates'
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
  rank: score,
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
  rank: score,
  ...extra,
})

describe('the For you feed', () => {
  it('lists each person once, best rank first, with a shared trip as a bump rather than a pin', () => {
    const feed = mergeFeed([{ tripId: 7, people: [trip('Ann', 40, { rank: 52 })] }], [interest('Bob', 90), interest('Ann', 40), interest('Cat', 50)])
    expect(feed.map((p) => p.profile_id)).toEqual(['Bob', 'Ann', 'Cat'])
    expect(feed[1]).toMatchObject({ trip_id: 7, score: 40, shared_interests: ['Museums', 'Wine'] })
  })

  it('pins people there at the same time to the top for Sodalis+', () => {
    const feed = mergeFeed([{ tripId: 7, people: [trip('Ann', 40)] }], [interest('Bob', 90), interest('Ann', 40)], true)
    expect(feed.map((p) => p.profile_id)).toEqual(['Ann', 'Bob'])
  })

  it('shows the exact dates of a shared trip on the free plan too', () => {
    const [ann] = mergeFeed([{ tripId: 7, people: [trip('Ann', 40)] }], [])
    expect(callouts(ann, '2026-10-07')[0]).toMatchObject({ kind: 'trip', text: `Lisbon · ${shortDates('2026-11-10', '2026-11-20', '2026-10-07')}` })
  })

  it('says why, strongest reason first', () => {
    const [ann] = mergeFeed([{ tripId: 7, people: [trip('Ann', 40)] }], [interest('Ann', 60, { shared_places: ['Rome'], shared_interests: ['Museums', 'Wine', 'Golf'] })], true)
    expect(callouts(ann, '2026-10-07').map((c) => c.text)).toEqual([
      // Date ranges are spaced differently by different Node versions.
      `Lisbon · ${shortDates('2026-11-10', '2026-11-20', '2026-10-07')}`,
      'Similar interests',
      'Wants to visit Rome',
    ])
    expect(callouts(ann)[0]).toMatchObject({ kind: 'trip', hint: 'same dates as you' })
  })

  it('colours a trip on nearby dates differently from one at the same time', () => {
    const [cat] = mergeFeed([{ tripId: 7, people: [trip('Cat', 40, { overlap_start: null, overlap_end: null })] }], [], true)
    expect(callouts(cat)[0]).toMatchObject({ kind: 'trip-close', hint: 'close to your dates' })
  })

  it('leaves the year out of this year’s dates', () => {
    expect(shortDates('2026-11-10', '2026-11-20', '2026-10-07')).not.toContain('2026')
    expect(shortDates('2027-01-10', '2027-01-20', '2026-10-07')).toContain('2027')
  })

  it('only says similar interests when there are 3 or more, and says when someone lives nearby', () => {
    const [bob] = mergeFeed([], [interest('Bob', 50, { shared_interests: ['Wine'], distance_km: 12, home_city: 'Otley' })])
    expect(callouts(bob).map((c) => c.text)).toEqual([])
    expect(nearYou(bob, 'Leeds')).toBe(true)
    expect(nearYou({ ...bob, home_city: 'Leeds' }, 'Leeds')).toBe(false)
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

describe('best days to meet', () => {
  it('finds the days when the most people are there with you', () => {
    const mine = { start: '2027-05-12', end: '2027-05-18' }
    const others = [
      { start: '2027-05-14', end: '2027-05-20' },
      { start: '2027-05-10', end: '2027-05-16' },
    ]
    expect(bestDays(mine, others)).toEqual({ start: '2027-05-14', end: '2027-05-16', count: 2 })
  })
  it('is empty when no one overlaps', () => {
    expect(bestDays({ start: '2027-05-12', end: '2027-05-18' }, [{ start: '2027-06-01', end: '2027-06-03' }])).toBeNull()
  })
})

describe('Who’s going', () => {
  it('groups people under the trip you share, and keeps the rest apart', () => {
    const feed = mergeFeed([{ tripId: 1, people: [trip('ann', 60), trip('bob', 40, { trip_city: 'Rome' })] }], [interest('cat', 50)])
    const { trips, others } = groupByTrip(feed)
    expect(trips.map((g) => [g.city, g.people.map((p) => p.profile_id)])).toEqual([
      ['Lisbon', ['ann']],
      ['Rome', ['bob']],
    ])
    expect(others.map((p) => p.profile_id)).toEqual(['cat'])
  })

  it('says what you share in plain words, with the days you’re both there', () => {
    const [free] = mergeFeed([{ tripId: 1, people: [trip('ann', 60)] }], [])
    expect(whatYouShare(free, tripTo(free, 'Lisbon'), '2026-10-12')[0]).toBe(`Both in Lisbon ${shortDates('2026-11-12', '2026-11-18', '2026-10-12')}`)
  })
})
