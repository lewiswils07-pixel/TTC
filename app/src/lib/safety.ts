// Block and report. The database applies blocks everywhere and keeps
// reports private to Lewis; these calls only pass the member's choice on.
import { friendlyError } from './errors'
import type { Option } from './options'
import { supabase } from './supabase'
import { rules } from './rules'

export type ReportReason = 'fake_profile' | 'asking_for_money' | 'harassment' | 'inappropriate' | 'feels_unsafe' | 'other'

export const REPORT_REASONS: readonly Option<ReportReason>[] = [
  { value: 'fake_profile', label: 'Fake profile' },
  { value: 'asking_for_money', label: 'Asks for money' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'feels_unsafe', label: 'Feels unsafe' },
  { value: 'other', label: 'Something else' },
]

export const MAX_REPORT_DETAILS = rules.safety.reportDetailsMax

export type BlockedMember = { profile_id: string; display_name: string; created_at: string }

export async function blockMember(id: string): Promise<void> {
  const { error } = await supabase.rpc('block_member', { p_id: id })
  if (error) throw friendlyError(error)
}

export async function unblockMember(id: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_member', { p_id: id })
  if (error) throw friendlyError(error)
}

export async function reportMember(id: string, reason: ReportReason, details: string): Promise<void> {
  const { error } = await supabase.rpc('report_member', { p_id: id, p_reason: reason, p_details: details.trim() || null })
  if (error) throw friendlyError(error)
}

/** Report one message someone sent me; counts as a report about them, with the message attached. */
export async function reportMessage(messageId: number, reason: ReportReason, details: string): Promise<void> {
  const { error } = await supabase.rpc('report_message', { p_message_id: messageId, p_reason: reason, p_details: details.trim() || null })
  if (error) throw friendlyError(error)
}

/** Members I've blocked, newest first. Null when this database doesn't have blocks yet. */
export async function myBlocks(): Promise<BlockedMember[] | null> {
  const { data, error } = await supabase.rpc('my_blocks')
  if (error?.code === 'PGRST202') return null
  if (error) throw friendlyError(error)
  return (data ?? []) as BlockedMember[]
}
