// ID check: a photo ID and a selfie, checked by Didit. The app's server
// (functions/api/id-check.ts) starts each check and records the answer;
// this file only asks it and the database how things stand.
import { brand } from './brand'
import { supabase } from './supabase'

export type IdCheck = { verifiedAt: string | null; status: string | null; triesLeft: number }

// Same address on the web; the phone app talks to the live site.
const API = `${typeof location !== 'undefined' && location.protocol.startsWith('http') ? '' : brand.appUrl}/api/id-check`
const LAST = 'sodalis.idCheck.session'

/** False until Lewis adds the Didit keys, so the screen can say "coming soon". */
export async function idCheckLive(): Promise<boolean> {
  try {
    const res = await fetch(API)
    return res.ok && ((await res.json()) as { live?: boolean }).live === true
  } catch {
    return false
  }
}

export async function myIdCheck(): Promise<IdCheck | null> {
  const { data, error } = await supabase.rpc('my_id_check')
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row) return null
  return { verifiedAt: row.verified_at, status: row.status, triesLeft: row.tries_left }
}

/** Starts a check and returns Didit's page to open. Throws a sentence a member can read. */
export async function startIdCheck(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Please sign in again.')
  let res: Response
  try {
    res = await fetch(API, { method: 'POST', headers: { authorization: `Bearer ${token}` } })
  } catch {
    throw new Error('We couldn’t connect. Check your internet connection and try again.')
  }
  const body = (await res.json().catch(() => ({}))) as { url?: string; session_id?: string; error?: string }
  if (!res.ok || !body.url) throw new Error(body.error ?? 'Something went wrong. Please try again in a minute.')
  try {
    if (body.session_id) localStorage.setItem(LAST, body.session_id)
  } catch {
    // Private browsing: Didit's return link carries the session anyway.
  }
  return body.url
}

/** After Didit sends the member back: ask how it went. */
export async function finishIdCheck(session: string | null): Promise<string | null> {
  let id = session
  try {
    id ??= localStorage.getItem(LAST)
  } catch {
    // Nothing saved on this phone.
  }
  if (!id) return null
  try {
    const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session_id: id }) })
    const body = (await res.json()) as { status?: string }
    return body.status ?? null
  } catch {
    return null
  }
}

/** Which of these members have passed, for the tick on cards. */
export async function idChecked(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const { data, error } = await supabase.rpc('id_checked', { ids })
  if (error || !Array.isArray(data)) return new Set()
  return new Set(data.map((r: string | { id_checked: string }) => (typeof r === 'string' ? r : r.id_checked)))
}

/** What the member reads about their check. */
export function idCheckWords(c: IdCheck | null): { title: string; text: string; canStart: boolean } {
  if (c?.verifiedAt) return { title: 'Your ID is checked', text: 'Members see a tick by your name, so they know you are who you say you are.', canStart: false }
  if (c?.status === 'In Review') return { title: 'We’re checking your ID', text: 'This usually takes a few minutes. We’ll show the tick here once it’s done.', canStart: false }
  if (c && c.triesLeft === 0) return { title: 'No tries left for now', text: 'You can try again next month. If something’s wrong, ask us on the Help page.', canStart: false }
  if (c?.status === 'Declined')
    return { title: 'Your ID check didn’t pass', text: 'This can happen with a blurry photo or glare. Try again in good light with your whole ID in the frame.', canStart: true }
  return {
    title: 'Check your ID',
    text: 'Take a photo of your passport or driving licence, then a quick selfie. It takes about two minutes, and members see a tick by your name.',
    canStart: true,
  }
}
