// Another member's full profile, for people you're connected with or share
// a group with. The database decides who can see it.
import { cleanAnswers, loadCard, type CardAnswer } from './card'
import { myConnections } from './connections'
import { friendlyError } from './errors'
import type { Budget, DayRhythm, HolidayPrefs, Pace, RoomSharing, TravelStyle, Walking } from './options'
import { supabase } from './supabase'

export type MemberProfile = {
  profile_id: string
  display_name: string
  birth_year: number | null
  home_city: string | null
  home_country: string | null
  photo_path: string | null
  bio: string | null
  travel_style: TravelStyle | null
  pace: Pace | null
  budget: Budget | null
  room_sharing: RoomSharing | null
  day_rhythm: DayRhythm | null
  walking: Walking | null
  languages: string[]
  travelling_with: string | null
  interests: { id: number; label: string }[]
  card_answers: CardAnswer[]
  connected_at: string | null
  /** Food preferences, e.g. vegetarian. */
  diet: string[]
}

/** Null when the member can't be shown (not connected, blocked or gone). */
export async function loadMemberProfile(profileId: string): Promise<MemberProfile | null> {
  const { data, error } = await supabase.rpc('member_profile', { p_profile: profileId })
  if (error) {
    // Until the database part with full profiles is live, show what a connection already shares.
    if (error.code === 'PGRST202') return basicProfile(profileId)
    throw friendlyError(error)
  }
  const row = (data as MemberProfile[] | null)?.[0]
  if (!row) return null
  // Food is a newer extra: a profile still shows if it can't be read.
  const diet = await Promise.resolve(supabase.rpc('member_diet', { p_profile: profileId })).then(
    (r) => r?.data,
    () => null,
  )
  return {
    ...row,
    languages: row.languages ?? [],
    interests: row.interests ?? [],
    card_answers: cleanAnswers(row.card_answers ?? []),
    diet: (diet as string[] | null) ?? [],
  }
}

async function basicProfile(profileId: string): Promise<MemberProfile | null> {
  const c = (await myConnections()).find((x) => x.profile_id === profileId && x.status === 'accepted')
  if (!c) return null
  const card = await loadCard(profileId)
  return {
    profile_id: c.profile_id,
    display_name: c.display_name,
    birth_year: c.birth_year,
    home_city: c.home_city,
    home_country: c.home_country,
    photo_path: c.photo_path,
    bio: null,
    travel_style: null,
    pace: null,
    budget: null,
    room_sharing: null,
    day_rhythm: null,
    walking: null,
    languages: [],
    diet: [],
    travelling_with: null,
    interests: [],
    card_answers: card.card_answers,
    connected_at: null,
  }
}

/** The extras on someone's card and profile (Lewis, 11 Oct). Holiday
 *  preferences come only with Sodalis+; `holiday_locked` says there are some
 *  to see. Personal details only when the member chose to show them. */
export type MemberExtras = {
  photo_book: string[]
  holiday_prefs: HolidayPrefs | null
  holiday_locked: boolean
  sexuality: string | null
  religion: string | null
  ethnicity: string | null
}

const extrasCache = new Map<string, Promise<MemberExtras | null>>()

/** Null before database Part 20 is live, or when they can't be shown. */
export function loadExtras(profileId: string): Promise<MemberExtras | null> {
  const hit = extrasCache.get(profileId)
  if (hit) return hit
  const load = Promise.resolve(supabase.rpc('member_extras', { p_profile: profileId })).then(
    ({ data, error }) => {
      if (error) {
        extrasCache.delete(profileId)
        return null
      }
      const row = (data as MemberExtras[] | null)?.[0]
      return row ? { ...row, photo_book: row.photo_book ?? [] } : null
    },
    () => {
      extrasCache.delete(profileId)
      return null
    },
  )
  extrasCache.set(profileId, load)
  return load
}

/** Forget a member's extras, for example after editing your own. */
export const forgetExtras = (profileId: string) => extrasCache.delete(profileId)
