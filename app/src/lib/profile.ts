// Everything the app reads or writes about the signed-in member's own
// profile. Row-level security limits every query here to their own rows.
import type { Card } from './card'
import type { City } from './cities'
import { friendlyError } from './errors'
import type { Budget, DayRhythm, Gender, Pace, RoomSharing, TravelStyle, Walking } from './options'
import { supabase } from './supabase'

export type Interest = { id: number; slug: string; label: string; category_label?: string | null }

export type Profile = {
  id: string
  display_name: string | null
  birth_year: number | null
  birth_date: string | null
  gender: Gender | null
  home_city_id: number | null
  bio: string | null
  photo_path: string | null
  travel_style: TravelStyle | null
  pace: Pace | null
  budget: Budget | null
  mobility_note: string | null
  travelling_with: string | null
  room_sharing: RoomSharing | null
  day_rhythm: DayRhythm | null
  walking: Walking | null
  languages: string[]
  onboarded_at: string | null
  member_number: number | null
  home_city: City | null
}

export type Preferences = {
  age_min: number
  age_max: number
  genders: Gender[]
  max_distance_km: number | null
}

/** `card` is null until the database part with member cards is live. */
export type MyProfile = { profile: Profile; interestIds: number[]; preferences: Preferences; card: Card | null }

// The foreign key is named because profiles also reach cities through the
// wishlist table, which would make a plain cities(...) embed ambiguous.
const PROFILE_COLUMNS =
  'id, display_name, birth_year, birth_date, gender, home_city_id, bio, photo_path, travel_style, pace, budget, mobility_note, travelling_with, room_sharing, day_rhythm, walking, languages, onboarded_at, member_number, home_city:cities!profiles_home_city_id_fkey(id, name, country_code)'

export async function getMyProfile(userId: string): Promise<MyProfile> {
  const [profile, interests, preferences, card] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single(),
    supabase.from('profile_interests').select('interest_id').eq('profile_id', userId),
    supabase.from('preferences').select('age_min, age_max, genders, max_distance_km').eq('profile_id', userId).single(),
    // Read on its own so the rest of the profile still loads before the card columns exist.
    supabase.from('profiles').select('card_answers').eq('id', userId).single(),
  ])
  const error = profile.error ?? interests.error ?? preferences.error
  if (error) throw friendlyError(error)
  return {
    profile: profile.data as unknown as Profile,
    interestIds: (interests.data ?? []).map((row) => row.interest_id as number),
    preferences: preferences.data as Preferences,
    card: card.error ? null : (card.data as Card),
  }
}

export type Basics = Pick<Profile, 'display_name' | 'birth_date' | 'gender' | 'home_city_id'>
export type AboutMe = Pick<Profile, 'bio'>
export type Style = Pick<
  Profile,
  'travel_style' | 'pace' | 'budget' | 'mobility_note' | 'travelling_with' | 'room_sharing' | 'day_rhythm' | 'walking' | 'languages'
>

async function updateProfile(userId: string, fields: Partial<Profile>): Promise<void> {
  const { error } = await supabase.from('profiles').update(fields).eq('id', userId)
  if (error) throw friendlyError(error)
}

export const saveBasics = (userId: string, basics: Basics) => updateProfile(userId, basics)
export const saveAboutMe = (userId: string, about: AboutMe) => updateProfile(userId, about)

export async function listInterests(): Promise<Interest[]> {
  // '*' so this works before and after the categories migration.
  const { data, error } = await supabase.from('interests').select('*').order('sort')
  if (error) throw friendlyError(error)
  return data as Interest[]
}

/** Replaces the member's interests. The database insists on 3 to 10. */
export async function saveInterests(ids: number[]): Promise<void> {
  const { error } = await supabase.rpc('set_my_interests', { interest_ids: ids })
  if (error) throw friendlyError(error)
}

export async function saveStyleAndPreferences(userId: string, style: Style, prefs: Preferences): Promise<void> {
  await updateProfile(userId, style)
  const { error } = await supabase.from('preferences').update(prefs).eq('profile_id', userId)
  if (error) throw friendlyError(error)
}

/** The member's food preferences. Empty on a database without them yet. */
export async function myDiet(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('profiles').select('diet').eq('id', userId).maybeSingle()
  return error ? [] : ((data?.diet as string[] | undefined) ?? [])
}

export async function saveDiet(userId: string, diet: string[]): Promise<void> {
  const { error } = await supabase.from('profiles').update({ diet }).eq('id', userId)
  // A database without food preferences yet: nothing to save.
  if (error && error.code !== 'PGRST204' && error.code !== '42703') throw friendlyError(error)
}

/** Marks the profile finished. The database checks nothing required is missing. */
export async function finishOnboarding(): Promise<void> {
  const { error } = await supabase.rpc('finish_onboarding')
  if (error) throw friendlyError(error)
}
