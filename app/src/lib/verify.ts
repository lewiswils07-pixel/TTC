// Verified members (round 8 testers, 23 Oct): the badge means they passed
// the ID check (lib/idCheck.ts).
import { supabase } from './supabase'

/** Which of these people are verified. Empty if the database can't say yet. */
export async function verifiedIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const { data, error } = await supabase.rpc('verified_members', { p_ids: ids.slice(0, 100) })
  return new Set(error ? [] : ((data ?? []) as string[]))
}
