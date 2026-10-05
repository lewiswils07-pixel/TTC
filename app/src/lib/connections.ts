// Connection requests. The database enforces who can ask whom and the
// weekly limit; these calls only pass the member's choices through.
import { friendlyError } from './errors'
import { supabase } from './supabase'

export type Connection = {
  id: number
  status: 'pending' | 'accepted'
  direction: 'sent' | 'received'
  note: string | null
  created_at: string
  profile_id: string
  display_name: string
  birth_year: number | null
  home_city: string | null
  home_country: string | null
  photo_path: string | null
  trip_city: string | null
  trip_start: string | null
  trip_end: string | null
}

export async function sendRequest(to: string, note: string, tripId?: number): Promise<void> {
  const { error } = await supabase.rpc('send_connection_request', { p_to: to, p_note: note.trim() || null, p_trip_id: tripId ?? null })
  if (error) throw friendlyError(error)
}

export async function respondToRequest(id: number, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_request', { p_id: id, p_accept: accept })
  if (error) throw friendlyError(error)
}

export async function withdrawRequest(id: number): Promise<void> {
  const { error } = await supabase.rpc('withdraw_request', { p_id: id })
  if (error) throw friendlyError(error)
}

/** Open requests both ways, and accepted connections, newest first. */
export async function myConnections(): Promise<Connection[]> {
  const { data, error } = await supabase.rpc('my_connections')
  if (error) throw friendlyError(error)
  return (data ?? []) as Connection[]
}

export async function requestsLeft(): Promise<number> {
  const { data, error } = await supabase.rpc('requests_left_this_week')
  if (error) throw friendlyError(error)
  return data as number
}
