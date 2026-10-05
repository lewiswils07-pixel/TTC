// "Did you meet?" after a shared trip, and the meeting-up guide. Answers
// are private: only the team sees them, as a trust signal for later.
import { friendlyError } from './errors'
import { supabase } from './supabase'

export type MeetPrompt = { connection_id: number; profile_id: string; display_name: string; photo_path: string | null; trip_city: string; trip_end: string }

/** People to ask me about. Empty when this database doesn't have it yet. */
export async function meetPrompts(): Promise<MeetPrompt[]> {
  const { data, error } = await supabase.rpc('meet_prompts')
  if (error) return []
  return (data ?? []) as MeetPrompt[]
}

/** again: true, false, or null for "not sure". Ignored when they didn't meet. */
export async function answerMeet(connectionId: number, met: boolean, again: boolean | null = null): Promise<void> {
  const { error } = await supabase.rpc('answer_meet', { p_connection_id: connectionId, p_met: met, p_again: met ? again : null })
  if (error) throw friendlyError(error)
}

// The short guide is shown once in chat, then stays one tap away.
const GUIDE_KEY = 'sodalis.meetGuideSeen'

export function guideSeen(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1'
  } catch {
    return false
  }
}

export function markGuideSeen(): void {
  try {
    localStorage.setItem(GUIDE_KEY, '1')
  } catch {
    // Private windows can refuse storage; the guide just shows again.
  }
}
