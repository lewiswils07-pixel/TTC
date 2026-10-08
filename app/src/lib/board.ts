// The shared plan board in each chat: ideas, votes, ticks. The database
// checks that only people in the chat can see or change it.
import { addDays } from './dates'
import { friendlyError } from './errors'
import { supabase } from './supabase'
import { rules } from './rules'

export const MAX_IDEA = rules.planBoard.ideaMax
export const MAX_LINK = rules.planBoard.linkMax

export type Idea = {
  id: number
  title: string
  day: number | null
  source_url: string | null
  added_by: string | null
  mine: boolean
  votes: number
  i_voted: boolean
  done: boolean
  created_at: string
}

export async function planBoard(conversationId: number): Promise<Idea[]> {
  const { data, error } = await supabase.rpc('plan_board', { p_conversation_id: conversationId })
  if (error) throw friendlyError(error)
  return (data ?? []) as Idea[]
}

export async function addIdea(conversationId: number, title: string, day: number | null, url: string): Promise<void> {
  const { error } = await supabase.rpc('add_plan_item', {
    p_conversation_id: conversationId,
    p_title: title.trim(),
    p_day: day,
    p_url: url.trim() || null,
  })
  if (error) throw friendlyError(error)
}

export async function toggleVote(id: number): Promise<void> {
  const { error } = await supabase.rpc('toggle_plan_vote', { p_item: id })
  if (error) throw friendlyError(error)
}

export async function setDone(id: number, done: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_plan_item_done', { p_item: id, p_done: done })
  if (error) throw friendlyError(error)
}

/** Change an idea's words (only the person who added it) or its day (anyone on the board). */
export async function editIdea(id: number, title: string, day: number | null): Promise<void> {
  const { error } = await supabase.rpc('edit_plan_item', { p_item: id, p_title: title.trim(), p_day: day })
  if (error) throw friendlyError(error)
}

export async function deleteIdea(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_plan_item', { p_item: id })
  if (error) throw friendlyError(error)
}

export function checkIdea(v: string): string | null {
  if (!v.trim()) return 'Please write the idea first.'
  if (v.trim().length > MAX_IDEA) return `Please keep this to ${MAX_IDEA} characters or fewer.`
  return null
}

/** Links must be full web addresses starting with https://. Empty is fine. */
export function checkLink(v: string): string | null {
  const t = v.trim()
  if (!t) return null
  if (!/^https:\/\/[^\s]+\.[^\s]+$/i.test(t) || t.length > MAX_LINK) return 'Please paste a full web address starting with https://'
  return null
}

/** Adds https:// to an address typed without it, like "www.example.com". */
export function normalizeLink(v: string): string {
  const t = v.trim()
  if (!t || /^[a-z]+:/i.test(t)) return t
  return /^[^\s/]+\.[^\s]+$/.test(t) ? `https://${t}` : t
}

/** "Day 2 · Tue 12 May" when the trip dates are known, else "Day 2". */
export function dayLabel(day: number, start?: string | null): string {
  if (!start) return `Day ${day}`
  const d = new Date(`${addDays(start, day - 1)}T12:00:00`)
  return `Day ${day} · ${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
}
