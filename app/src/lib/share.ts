// The trusted-contact link (task T17): a private page a member sends to a
// friend or relative before meeting someone. It shows who, where and when,
// and whether the member has checked in as back safe.
import { friendlyError } from './errors'
import { supabase } from './supabase'

export const MAX_PLACE = 120
export const MAX_NOTE = 300

export type Person = { name: string; age: number | null; home: string | null; member_number: number | null }

export type MeetupShare = {
  id: number
  token: string
  conversation_id: number | null
  meeting_with: Person[]
  place: string
  meet_at: string
  note: string | null
  checked_in_at: string | null
  stopped_at: string | null
}

export type SharedMeetup = {
  member: string
  meeting_with: Person[]
  place: string
  meet_at: string
  note: string | null
  checked_in_at: string | null
  ends_at: string
}

const ENDS_AFTER_MS = 2 * 24 * 60 * 60 * 1000

/** The member's links for one chat that still work, soonest first. Empty when this database doesn't have them yet. */
export async function myShares(conversationId: number): Promise<MeetupShare[]> {
  const { data, error } = await supabase
    .from('meetup_shares')
    .select('id, token, conversation_id, meeting_with, place, meet_at, note, checked_in_at, stopped_at')
    .eq('conversation_id', conversationId)
    .is('stopped_at', null)
    .gt('meet_at', new Date(Date.now() - ENDS_AFTER_MS).toISOString())
    .order('meet_at')
  if (error) return []
  return (data ?? []) as MeetupShare[]
}

export async function createShare(conversationId: number, place: string, meetAt: Date, note: string): Promise<MeetupShare> {
  const { data, error } = await supabase.rpc('create_meetup_share', {
    p_conversation_id: conversationId,
    p_place: place,
    p_meet_at: meetAt.toISOString(),
    p_note: note || null,
  })
  if (error) throw friendlyError(error)
  return data as MeetupShare
}

export async function checkIn(id: number): Promise<void> {
  const { error } = await supabase.rpc('check_in_meetup_share', { p_id: id })
  if (error) throw friendlyError(error)
}

export async function stopSharing(id: number): Promise<void> {
  const { error } = await supabase.rpc('stop_meetup_share', { p_id: id })
  if (error) throw friendlyError(error)
}

/** What the trusted contact sees. Null when the link is wrong, stopped or has ended. */
export async function viewShare(token: string): Promise<SharedMeetup | null> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null
  const { data, error } = await supabase.rpc('view_meetup_share', { p_token: token })
  if (error) throw friendlyError(error)
  return (data ?? null) as SharedMeetup | null
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/safe/${token}`
}

/** Opens the phone's share sheet, or copies the link where there isn't one. Returns what happened. */
export async function sendLink(share: Pick<MeetupShare, 'token' | 'place'>, member: string): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = shareUrl(share.token)
  const text = `${member} is meeting someone from Sodalis Collective at ${share.place}. This private link shows who, where and when, and whether ${member} is back safe.`
  if (navigator.share) {
    try {
      await navigator.share({ title: 'My meet-up', text, url })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }
  await navigator.clipboard.writeText(url)
  return 'copied'
}

/** "John, 55, from Leeds (member no. 12)" */
export function describePerson(p: Person): string {
  const bits = [p.name, p.age != null ? String(p.age) : null, p.home ? `from ${p.home}` : null].filter(Boolean).join(', ')
  return p.member_number ? `${bits} (member no. ${p.member_number})` : bits
}

/** "Saturday 12 October at 14:00 BST", in the reader's own time zone. */
export function meetTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
}

/** The value for a datetime-local input, in local time. */
export function localInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
