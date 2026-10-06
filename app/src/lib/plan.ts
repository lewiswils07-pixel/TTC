// Which plan the member is on. Only the server can change it; this just
// reads it so screens can show the right limits and unlock Sodalis+ filters.
import { requestsLeft } from './connections'
import { supabase } from './supabase'
import { rules } from './rules'

export const FREE_WEEKLY_REQUESTS = rules.requests.perWeekFree
/** Sodalis+ requests are unlimited to members; this only stops spam. */
export const PLUS_WEEKLY_REQUESTS = rules.requests.plusSafetyCap
export const FREE_GROUPS = rules.groups.maxOwnedFree
export const PLUS_GROUPS = rules.groups.maxOwnedPlus

/** False when the database doesn't know about plans yet. */
export async function hasPlus(): Promise<boolean> {
  const { data, error } = await supabase.rpc('i_have_plus')
  return !error && data === true
}

export const weeklyRequests = (plus: boolean) => (plus ? PLUS_WEEKLY_REQUESTS : FREE_WEEKLY_REQUESTS)

/** How many connection requests are left this week, out of how many. */
export async function loadRequests(): Promise<{ left: number; limit: number; plus: boolean }> {
  const [left, plus] = await Promise.all([requestsLeft(), hasPlus()])
  return { left, limit: weeklyRequests(plus), plus }
}

/** "You have 3 of 5 requests left this week." Sodalis+ members only see it near the spam guard. */
export function requestsLeftText({ left, limit, plus }: { left: number; limit: number; plus: boolean }): string {
  if (plus && left > rules.requests.plusShowLeftBelow) return ''
  return `You have ${left} of ${limit} requests left this week${left === 0 ? '; you get more on Monday' : ''}.`
}

/** When the member's Sodalis+ ends: a date, null if it doesn't, undefined if they don't have it. */
export async function plusUntil(): Promise<string | null | undefined> {
  const { data, error } = await supabase.from('entitlements').select('plan, expires_at').maybeSingle()
  if (error || data?.plan !== 'plus') return undefined
  if (data.expires_at && new Date(data.expires_at) < new Date()) return undefined
  return data.expires_at
}
