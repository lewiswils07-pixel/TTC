// KPIs for the team's Insights page, and the small things the app records
// so they can be counted: where members heard about us, when they were first
// shown a match, and a "would you recommend us" score.
import { friendlyError } from './errors'
import type { Option } from './options'
import { supabase } from './supabase'

type Count = number
type Week = { week: string; count: Count }

export type Kpis = {
  period_days: number
  acquisition: {
    members: Count
    new_members: Count
    started_not_finished: Count
    by_week: Week[]
    by_channel: Record<string, Count>
    phone_verified: Count
    age_bands: Record<string, Count>
    genders: Record<string, Count>
  }
  liquidity: {
    members_with_trip: Count
    upcoming_trips: Count
    trips_with_overlap: Count
    top_places: { city: string; month: string; members: Count }[]
    shown_a_match: Count
    median_hours_to_first_match: number | null
  }
  matching: {
    requests: Count
    accepted: Count
    declined: Count
    waiting: Count
    met: Count
    would_travel_again: Count
    would_not: Count
    reports: Count
    blocks: Count
    flagged_messages: Count
    active_members: Count
  }
  retention: {
    active_today: Count
    active_7_days: Count
    active_30_days: Count
    weekly_active: Week[]
    with_a_connection: Count
    with_2_connections: Count
    profile: { photo: Count; bio: Count; travel_style: Count; trip: Count }
    joined_over_30_days: Count
    gone_quiet: Count
    quiet_after_poor_match: Count
    poor_match_members: Count
  }
  community: {
    groups: Count
    in_a_group: Count
    heard_from_member: Count
    said_where_heard: Count
    nps_responses: Count
    nps_promoters: Count
    nps_detractors: Count
    nps_comments: { score: number; comment: string; at: string }[]
  }
}

export async function adminKpis(days: number): Promise<Kpis> {
  const { data, error } = await supabase.rpc('admin_kpis', { p_days: days })
  if (error) throw friendlyError(error)
  return data as Kpis
}

/** "40%", or "–" when there's nothing to divide by yet. */
export function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–'
}

/** Net Promoter Score: % who'd score 9–10 minus % who'd score 0–6. */
export function npsScore(promoters: number, detractors: number, responses: number): number | null {
  return responses > 0 ? Math.round(((promoters - detractors) / responses) * 100) : null
}

export type HeardFrom = 'member' | 'friend' | 'instagram' | 'facebook' | 'tiktok' | 'search' | 'press' | 'event' | 'other'

export const HEARD_FROM: readonly Option<HeardFrom>[] = [
  { value: 'member', label: 'A member' },
  { value: 'friend', label: 'A friend' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'search', label: 'Google' },
  { value: 'press', label: 'News or radio' },
  { value: 'event', label: 'An event' },
  { value: 'other', label: 'Somewhere else' },
]

export async function saveHeardFrom(userId: string, value: HeardFrom): Promise<void> {
  const { error } = await supabase.from('profiles').update({ heard_from: value }).eq('id', userId)
  if (error) throw friendlyError(error)
}

/** Records the first time a member is shown a suggested person. Quietly does nothing on older databases. */
export function noteFirstMatch(): void {
  void supabase.rpc('note_first_match').then(
    () => undefined,
    () => undefined,
  )
}

export async function npsDue(): Promise<boolean> {
  const { data, error } = await supabase.rpc('nps_due')
  return !error && data === true
}

export async function answerNps(score: number, comment: string): Promise<void> {
  const { error } = await supabase.rpc('answer_nps', { p_score: score, p_comment: comment.trim() || null })
  if (error) throw friendlyError(error)
}
