// Verified members (round 8 testers, 23 Oct). For now "Verify me" is a
// stand-in: one tap marks the member as verified. The real ID check will
// replace it, and the badge stays the same.
import { friendlyError } from './errors'
import { supabase } from './supabase'

/** Which of these people are verified. Empty if the database can't say yet. */
export async function verifiedIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const { data, error } = await supabase.rpc('verified_members', { p_ids: ids.slice(0, 100) })
  return new Set(error ? [] : ((data ?? []) as string[]))
}

/** Marks the signed-in member as verified. */
export async function verifyMe(): Promise<void> {
  const { error } = await supabase.rpc('verify_me_now')
  if (error) throw friendlyError(error)
}
