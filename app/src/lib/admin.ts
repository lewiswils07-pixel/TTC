// The review page (admins only) and the team's notices to members. The
// database checks who is an admin; the app only decides what to show.
import { friendlyError } from './errors'
import { REPORT_REASONS } from './safety'
import { supabase } from './supabase'

export type QueueItem = {
  kind: 'report' | 'flag'
  id: number
  created_at: string
  subject_id: string | null
  subject_name: string | null
  subject_status: string | null
  subject_joined: string | null
  reporter_name: string | null
  reasons: string[]
  details: string | null
  message_body: string | null
  open_reports: number
  past_actions: number
}
export type PausedMember = { profile_id: string; display_name: string | null; status: 'suspended' | 'deleted'; since: string | null }
export type LogEntry = { id: number; created_at: string; admin_name: string | null; subject_name: string | null; action: AdminAction; note: string | null }
export type AdminAction = 'dismiss' | 'warn' | 'suspend' | 'remove' | 'reinstate'

export type Notice = { id: number; kind: 'warning' | 'suspended' | 'removed' | 'reinstated'; body: string | null; created_at: string }

const FLAG_REASONS: Record<string, string> = {
  money: 'Money',
  bank: 'Bank details',
  gift_card: 'Gift cards',
  crypto: 'Crypto or investing',
  off_app: 'Moving off the app',
  phone: 'Phone number on day one',
}

/** Plain words for a report reason or a scam-guard reason. */
export function reasonLabel(code: string): string {
  return REPORT_REASONS.find((r) => r.value === code)?.label ?? FLAG_REASONS[code] ?? code
}

export const ACTION_LABELS: Record<AdminAction, string> = {
  dismiss: 'Dismissed',
  warn: 'Warned',
  suspend: 'Suspended',
  remove: 'Removed',
  reinstate: 'Reinstated',
}

/** Is the signed-in member an admin? False when this database doesn't have the review page yet. */
export async function iAmAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('i_am_admin')
  if (error) return false
  return data === true
}

export async function adminQueue(): Promise<QueueItem[]> {
  const { data, error } = await supabase.rpc('admin_queue')
  if (error) throw friendlyError(error)
  return (data ?? []) as QueueItem[]
}

export async function pausedMembers(): Promise<PausedMember[]> {
  const { data, error } = await supabase.rpc('admin_paused_members')
  if (error) throw friendlyError(error)
  return (data ?? []) as PausedMember[]
}

export async function adminLog(): Promise<LogEntry[]> {
  const { data, error } = await supabase.rpc('admin_log')
  if (error) throw friendlyError(error)
  return (data ?? []) as LogEntry[]
}

export async function adminAct(kind: 'report' | 'flag' | 'member', id: number | string, action: AdminAction, note: string): Promise<void> {
  const { error } = await supabase.rpc('admin_act', { p_kind: kind, p_id: String(id), p_action: action, p_note: note.trim() || null })
  if (error) throw friendlyError(error)
}

/** Notices from the team that are still showing. Empty when this database doesn't have them yet. */
export async function myNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('member_notices')
    .select('id, kind, body, created_at')
    .is('seen_at', null)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as Notice[]
}

export async function dismissNotice(id: number): Promise<void> {
  const { error } = await supabase.rpc('dismiss_notice', { p_id: id })
  if (error) throw friendlyError(error)
}
