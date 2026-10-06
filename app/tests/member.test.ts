import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../src/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

const { loadMemberProfile } = await import('../src/lib/member')

const connection = {
  id: 1,
  status: 'accepted',
  direction: 'sent',
  note: null,
  created_at: '2026-10-01T10:00:00Z',
  profile_id: 'p1',
  display_name: 'Ann',
  birth_year: 1960,
  home_city: 'Leeds',
  home_country: 'GB',
  photo_path: null,
  trip_city: null,
  trip_start: null,
  trip_end: null,
}

describe("a connection's profile", () => {
  beforeEach(() => rpc.mockReset())

  it('tidies what the database sends', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ profile_id: 'p1', display_name: 'Ann', languages: null, interests: [{ id: 1, label: 'Hiking' }], card_answers: [{ q: 'not_a_question', a: 'x' }, { q: 'how_often', a: ' Twice  a year ' }] }],
      error: null,
    })
    const m = await loadMemberProfile('p1')
    expect(rpc).toHaveBeenCalledWith('member_profile', { p_profile: 'p1' })
    expect(m?.languages).toEqual([])
    expect(m?.card_answers).toEqual([{ q: 'how_often', a: 'Twice a year' }])
  })

  it('is null when the member can’t be shown', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null })
    expect(await loadMemberProfile('p1')).toBeNull()
  })

  it('falls back to what a connection already shares before the database part is live', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'member_profile') return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'missing' } })
      if (name === 'my_connections') return Promise.resolve({ data: [connection], error: null })
      return Promise.resolve({ data: [{ card_answers: [{ q: 'dream_trip', a: 'Japan' }] }], error: null })
    })
    const m = await loadMemberProfile('p1')
    expect(m?.display_name).toBe('Ann')
    expect(m?.interests).toEqual([])
    expect(m?.card_answers).toEqual([{ q: 'dream_trip', a: 'Japan' }])
    expect(await loadMemberProfile('someone-else')).toBeNull()
  })
})
