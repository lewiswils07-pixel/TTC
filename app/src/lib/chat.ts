// One-to-one chat between connected members. The database decides who can
// read and send; new messages arrive live through Supabase Realtime.
import { friendlyError } from './errors'
import { supabase } from './supabase'

export const MAX_MESSAGE = 2000
export const PAGE_SIZE = 50

export type Conversation = {
  id: number
  kind: 'direct' | 'group'
  group_id: number | null
  /** The other person in a one-to-one chat; empty for a group. */
  profile_id: string | null
  display_name: string
  birth_year: number | null
  photo_path: string | null
  last_body: string | null
  last_at: string
  last_mine: boolean | null
  last_sender: string | null
  unread: number
  can_message: boolean
}

export type Message = { id: number; conversation_id: number; sender_id: string; body: string; created_at: string }

const missing = (code?: string) => code === 'PGRST202' || code === 'PGRST205' || code === '42P01'

/** Newest first. Null when this database doesn't have chat yet. */
export async function myConversations(): Promise<Conversation[] | null> {
  const { data, error } = await supabase.rpc('my_conversations')
  if (missing(error?.code)) return null
  if (error) throw friendlyError(error)
  return (data ?? []) as Conversation[]
}

/** Up to PAGE_SIZE messages before `beforeId` (or the latest), oldest first. */
export async function listMessages(conversationId: number, beforeId?: number): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('id', { ascending: false })
    .limit(PAGE_SIZE)
  if (beforeId) query = query.lt('id', beforeId)
  const { data, error } = await query
  if (error) throw friendlyError(error)
  return ((data ?? []) as Message[]).reverse()
}

export async function sendMessage(conversationId: number, body: string): Promise<number> {
  const { data, error } = await supabase.rpc('send_message', { p_conversation_id: conversationId, p_body: body })
  if (error) throw friendlyError(error)
  return data as number
}

/** Messages sent to me here that should carry a scam warning. */
export async function messageWarnings(conversationId: number): Promise<Set<number>> {
  const { data, error } = await supabase.rpc('message_warnings', { p_conversation_id: conversationId })
  if (error) return new Set()
  return new Set((data ?? []) as number[])
}

export async function markRead(conversationId: number): Promise<void> {
  await supabase.rpc('mark_read', { p_conversation_id: conversationId })
}

/** Names of everyone who has written here, for a group chat. */
export async function conversationSenders(conversationId: number): Promise<Map<string, string>> {
  const { data } = await supabase.rpc('conversation_senders', { p_conversation_id: conversationId })
  return new Map(((data ?? []) as { profile_id: string; display_name: string }[]).map((s) => [s.profile_id, s.display_name]))
}

/**
 * Calls onMessage for each new message in this conversation, and onReady
 * once listening has started. Returns a function that stops listening.
 */
export function onNewMessage(conversationId: number, onReady: () => void, onMessage: (m: Message) => void): () => void {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) =>
      onMessage(payload.new as Message),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onReady()
    })
  return () => {
    void supabase.removeChannel(channel)
  }
}

/** "14:05" today, "Mon 14:05" this week, else "3 Oct". */
export function messageTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const days = (now.getTime() - d.getTime()) / 86_400_000
  if (d.toDateString() === now.toDateString()) return time
  if (days < 6) return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
