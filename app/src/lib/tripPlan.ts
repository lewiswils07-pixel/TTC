// Your own day-by-day plan for one of your trips. Only you can see it; the
// database checks the trip is yours.
import { friendlyError } from './errors'
import { supabase } from './supabase'

export type PlanItem = { id: number; title: string; day: number | null; source_url: string | null; done: boolean; created_at: string }

export async function tripPlan(tripId: number): Promise<PlanItem[]> {
  const { data, error } = await supabase.rpc('trip_plan', { p_trip_id: tripId })
  if (error) throw friendlyError(error)
  return (data ?? []) as PlanItem[]
}

export async function addTripIdea(tripId: number, title: string, day: number | null, url: string | null): Promise<void> {
  const { error } = await supabase.rpc('add_trip_idea', { p_trip_id: tripId, p_title: title.trim(), p_day: day, p_url: url?.trim() || null })
  if (error) throw friendlyError(error)
}

export async function updateTripIdea(item: PlanItem, change: { done?: boolean; day?: number | null }): Promise<void> {
  const { error } = await supabase.rpc('update_trip_idea', {
    p_item: item.id,
    p_done: change.done ?? item.done,
    p_day: change.day === undefined ? item.day : change.day,
  })
  if (error) throw friendlyError(error)
}

export async function deleteTripIdea(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_trip_idea', { p_item: id })
  if (error) throw friendlyError(error)
}
