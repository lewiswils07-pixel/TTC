// Groups: a general chat, or a trip group with a place and dates. The database
// checks who can be invited (connections only, no blocks, groups.maxPeople at
// most) and how many groups a member can start.
import { friendlyError } from './errors'
import { supabase } from './supabase'
import { rules } from './rules'

export const MAX_GROUP = rules.groups.maxPeople
export const MAX_GROUP_NAME = rules.groups.nameMax

export type Group = {
  id: number
  name: string
  /** Empty for a general group, which has no place or dates. */
  city: string | null
  country_code: string | null
  start_date: string | null
  end_date: string | null
  my_status: 'invited' | 'joined'
  i_own: boolean
  owner_name: string
  members: number
  conversation_id: number | null
  /** A trip two connections are planning together (it can grow into a group). */
  is_pair?: boolean
  city_id?: number
}

export type GroupPerson = {
  profile_id: string
  display_name: string
  birth_year: number | null
  photo_path: string | null
  role: 'owner' | 'member'
  status: 'invited' | 'joined'
}

/** Who can join: open groups can be found and joined by anyone who fits. */
export type GroupSettings = { open: boolean; women_only: boolean; age_min: number | null; age_max: number | null }

export type NewGroup = { name: string; trip: { cityId: number; start: string; end: string } | null; invite: string[]; settings?: GroupSettings }

/** An open trip group someone could join. */
export type OpenGroup = {
  id: number
  name: string
  city: string
  country_code: string
  city_id: number
  start_date: string
  end_date: string
  members: number
  max_people: number
  owner_name: string
  women_only: boolean
  age_min: number | null
  age_max: number | null
  going_when_you_are: boolean
}

export type GroupDates = { profile_id: string; display_name: string; start_date: string; end_date: string }

/** True when a group is for a trip, with a place and dates. */
export const isTripGroup = (g: Pick<Group, 'city' | 'start_date' | 'end_date'>): g is Group & { city: string; start_date: string; end_date: string } => !!g.city && !!g.start_date && !!g.end_date

const missing = (code?: string) => code === 'PGRST202' || code === 'PGRST205' || code === '42P01'

/** My groups and invites. Null when this database doesn't have groups yet. */
export async function myGroups(): Promise<Group[] | null> {
  const { data, error } = await supabase.rpc('my_groups')
  if (missing(error?.code)) return null
  if (error) throw friendlyError(error)
  return (data ?? []) as Group[]
}

export async function groupsICanStart(): Promise<number> {
  const { data, error } = await supabase.rpc('groups_i_can_start')
  if (error) throw friendlyError(error)
  return data as number
}

export async function groupPeople(groupId: number): Promise<GroupPerson[]> {
  const { data, error } = await supabase.rpc('group_people', { p_group: groupId })
  if (error) throw friendlyError(error)
  return (data ?? []) as GroupPerson[]
}

export async function createGroup(g: NewGroup): Promise<number> {
  const { data, error } = await supabase.rpc('create_group', {
    p_name: g.name.trim(),
    p_city_id: g.trip?.cityId ?? null,
    p_start: g.trip?.start ?? null,
    p_end: g.trip?.end ?? null,
    p_invite: g.invite,
    // Sent only when set, so this works before database Part 24 too.
    ...(g.settings && (g.settings.open || g.settings.women_only || g.settings.age_min || g.settings.age_max)
      ? { p_open: g.settings.open, p_women_only: g.settings.women_only, p_age_min: g.settings.age_min, p_age_max: g.settings.age_max }
      : {}),
  })
  if (error) throw friendlyError(error)
  return data as number
}

/** Open trip groups I could join, optionally near one place. Empty before database Part 24. */
export async function openGroups(cityId?: number): Promise<OpenGroup[]> {
  const { data, error } = await supabase.rpc('open_groups', cityId ? { p_city_id: cityId } : {})
  if (missing(error?.code)) return []
  if (error) throw friendlyError(error)
  return (data ?? []) as OpenGroup[]
}

export async function joinOpenGroup(groupId: number): Promise<void> {
  const { error } = await supabase.rpc('join_open_group', { p_group: groupId })
  if (error) throw friendlyError(error)
}

/** A group's settings, for the people in it. Null before database Part 24. */
export async function groupSettings(groupId: number): Promise<GroupSettings | null> {
  const { data, error } = await supabase.rpc('group_settings', { p_group: groupId })
  if (error) return null
  return ((data ?? []) as GroupSettings[])[0] ?? null
}

/** "Open to anyone · Women only · Ages 45 to 75", or null for a plain invite-only group. */
export function settingsLabel(s: Pick<GroupSettings, 'women_only' | 'age_min' | 'age_max'> & { open?: boolean }): string | null {
  const ages = s.age_min && s.age_max ? `Ages ${s.age_min} to ${s.age_max}` : s.age_min ? `Ages ${s.age_min} and over` : s.age_max ? `Ages up to ${s.age_max}` : null
  const parts = [s.open ? 'Open to anyone who fits' : null, s.women_only ? 'Women only' : null, ages].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

/** Turn a general group into a trip group, or change its trip. */
export async function setGroupTrip(groupId: number, cityId: number, start: string, end: string): Promise<void> {
  const { error } = await supabase.rpc('set_group_trip', { p_group: groupId, p_city_id: cityId, p_start: start, p_end: end })
  if (error) throw friendlyError(error)
}

/** Each member's own dates for a trip group. */
export async function groupDates(groupId: number): Promise<GroupDates[]> {
  const { data, error } = await supabase.rpc('group_dates', { p_group: groupId })
  if (error) throw friendlyError(error)
  return (data ?? []) as GroupDates[]
}

export async function inviteToGroup(groupId: number, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('invite_to_group', { p_group: groupId, p_ids: ids })
  if (error) throw friendlyError(error)
}

export async function respondToInvite(groupId: number, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_group_invite', { p_group: groupId, p_accept: accept })
  if (error) throw friendlyError(error)
}

/** Leave a group, or remove someone from a group I started. */
export async function leaveGroup(groupId: number, memberId?: string): Promise<void> {
  const { error } = await supabase.rpc('leave_group', { p_group: groupId, p_member: memberId ?? null })
  if (error) throw friendlyError(error)
}

export function checkGroupName(v: string): string | null {
  if (!v.trim()) return 'Please give your group a name.'
  if (v.trim().length > MAX_GROUP_NAME) return `Please keep the name to ${MAX_GROUP_NAME} characters or fewer.`
  return null
}
