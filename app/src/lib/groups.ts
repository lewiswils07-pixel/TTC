// Small trip groups. The database checks who can be invited (connections
// only, no blocks, 6 people at most) and how many groups a member can start.
import { friendlyError } from './errors'
import { supabase } from './supabase'
import { rules } from './rules'

export const MAX_GROUP = rules.groups.maxPeople
export const MAX_GROUP_NAME = rules.groups.nameMax

export type Group = {
  id: number
  name: string
  city: string
  country_code: string
  start_date: string
  end_date: string
  my_status: 'invited' | 'joined'
  i_own: boolean
  owner_name: string
  members: number
  conversation_id: number | null
}

export type GroupPerson = {
  profile_id: string
  display_name: string
  birth_year: number | null
  photo_path: string | null
  role: 'owner' | 'member'
  status: 'invited' | 'joined'
}

export type NewGroup = { name: string; cityId: number; start: string; end: string; invite: string[] }

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
    p_city_id: g.cityId,
    p_start: g.start,
    p_end: g.end,
    p_invite: g.invite,
  })
  if (error) throw friendlyError(error)
  return data as number
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
