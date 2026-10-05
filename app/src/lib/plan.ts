// Which plan the member is on. Only the server can change it; this just
// reads it so screens can show the right limits and unlock Sodalis+ filters.
import { supabase } from './supabase'

export const FREE_WEEKLY_REQUESTS = 5
export const PLUS_WEEKLY_REQUESTS = 50

/** False when the database doesn't know about plans yet. */
export async function hasPlus(): Promise<boolean> {
  const { data, error } = await supabase.rpc('i_have_plus')
  return !error && data === true
}

export const weeklyRequests = (plus: boolean) => (plus ? PLUS_WEEKLY_REQUESTS : FREE_WEEKLY_REQUESTS)
