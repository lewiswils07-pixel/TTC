// Which plan the member is on. Only the server can change it; this just
// reads it so screens can show the right limits and unlock Sodalis+ filters.
import { requestsLeft } from './connections'
import { supabase } from './supabase'
import { rules } from './rules'

export const FREE_WEEKLY_REQUESTS = rules.requests.perWeekFree
export const PLUS_WEEKLY_REQUESTS = rules.requests.perWeekPlus
export const FREE_GROUPS = rules.groups.maxOwnedFree
export const PLUS_GROUPS = rules.groups.maxOwnedPlus

/** False when the database doesn't know about plans yet. */
export async function hasPlus(): Promise<boolean> {
  const { data, error } = await supabase.rpc('i_have_plus')
  return !error && data === true
}

export const weeklyRequests = (plus: boolean) => (plus ? PLUS_WEEKLY_REQUESTS : FREE_WEEKLY_REQUESTS)

/** How many connection requests are left this week, out of how many. */
export async function loadRequests(): Promise<{ left: number; limit: number }> {
  const [left, plus] = await Promise.all([requestsLeft(), hasPlus()])
  return { left, limit: weeklyRequests(plus) }
}
