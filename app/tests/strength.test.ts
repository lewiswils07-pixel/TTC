import { describe, expect, it } from 'vitest'
import type { Profile } from '../src/lib/profile'
import { profileStrength } from '../src/lib/strength'

const empty = { photo_path: null, bio: null, travel_style: null, pace: null, budget: null, room_sharing: null, day_rhythm: null, walking: null, languages: [] } as unknown as Profile

describe('profile strength', () => {
  it('starts low and lists what to add first', () => {
    const { percent, parts } = profileStrength(empty, 3, false)
    expect(percent).toBe(0)
    expect(parts[0]).toMatchObject({ label: 'Add a photo', done: false })
  })
  it('reaches 100% with everything filled in', () => {
    const full = { ...empty, photo_path: 'x/1.jpg', bio: 'Hi', travel_style: 'mix', pace: 'slow', budget: 'mid', room_sharing: 'share', day_rhythm: 'early', walking: 'lots', languages: ['en'] } as Profile
    expect(profileStrength(full, 6, true).percent).toBe(100)
    expect(profileStrength(full, 6, false).percent).toBe(83)
  })
})
