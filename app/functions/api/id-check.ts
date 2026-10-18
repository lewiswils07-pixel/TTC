// The app's only server code: the ID check, run on Cloudflare Pages
// Functions at /api/id-check. It holds the two secret keys (Supabase
// service_role and Didit), which must never reach a phone.
//
//   GET                         -> { live }  is the check switched on?
//   POST (signed-in member)     -> { url }   start a check, open url
//   POST { session_id }         -> { status } ask Didit how a check went
//                                  (from the app on return, and Didit's webhook)
//
// Didit's answer is always fetched from Didit with our key, so nobody can
// fake a pass by posting to this address.

import rules from '../../rules.json'

export interface Env {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  DIDIT_API_KEY?: string
  DIDIT_WORKFLOW_ID?: string
}

type Context = { request: Request; env: Env }

const DIDIT = 'https://verification.didit.me/v3'
const MIN_AGE = rules.age.min
// The live database's public address (also in app/.env); SUPABASE_URL overrides it for a test database.
const LIVE_DB = 'https://uibywuqdbkubqqumwzuw.supabase.co'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

function config(env: Env) {
  const supabase = env.SUPABASE_URL || LIVE_DB
  const { SUPABASE_SERVICE_ROLE_KEY: service, DIDIT_API_KEY: didit, DIDIT_WORKFLOW_ID: workflow } = env
  return service && didit && workflow ? { supabase, service, didit, workflow } : null
}
type Config = NonNullable<ReturnType<typeof config>>

async function rpc<T>(c: Config, name: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${c.supabase}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: c.service, authorization: `Bearer ${c.service}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`${name} ${res.status}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

/** The signed-in member, from the app's own sign-in token. */
async function member(c: Config, request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')
  if (!token?.startsWith('Bearer ')) return null
  const res = await fetch(`${c.supabase}/auth/v1/user`, { headers: { apikey: c.service, authorization: token } })
  if (!res.ok) return null
  const user = (await res.json()) as { id?: string }
  return user.id ?? null
}

/** Age in whole years on the day, from "YYYY-MM-DD". */
export function ageOn(birth: string, today = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birth)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const before = today.getUTCMonth() + 1 < mo || (today.getUTCMonth() + 1 === mo && today.getUTCDate() < d)
  return today.getUTCFullYear() - y - (before ? 1 : 0)
}

type Decision = {
  status?: string
  vendor_data?: string
  id_verification?: { date_of_birth?: string }
  id_verifications?: { date_of_birth?: string }[]
}

/** Didit's status, turned into ours: under-18s never pass. */
export function outcome(d: Decision): string {
  const status = d.status ?? 'Unknown'
  if (status !== 'Approved') return status
  const birth = d.id_verifications?.[0]?.date_of_birth ?? d.id_verification?.date_of_birth
  const age = birth ? ageOn(birth) : null
  return age !== null && age < MIN_AGE ? 'Declined' : 'Approved'
}

async function start(c: Config, request: Request): Promise<Response> {
  const id = await member(c, request)
  if (!id) return json({ error: 'Please sign in again.' }, 401)
  const allowed = await rpc<string>(c, 'id_check_allowed', { member: id })
  if (allowed === 'verified') return json({ error: 'Your ID is already checked.' }, 409)
  if (allowed !== 'ok') return json({ error: 'You’ve used your tries for now. Please try again next month, or ask us for help.' }, 429)
  const origin = new URL(request.url).origin
  const res = await fetch(`${DIDIT}/session/`, {
    method: 'POST',
    headers: { 'x-api-key': c.didit, 'content-type': 'application/json' },
    body: JSON.stringify({ workflow_id: c.workflow, vendor_data: id, callback: `${origin}/verify-id` }),
  })
  if (!res.ok) return json({ error: 'The ID check isn’t answering. Please try again in a minute.' }, 502)
  const session = (await res.json()) as { session_id?: string; url?: string }
  if (!session.session_id || !session.url) return json({ error: 'The ID check isn’t answering. Please try again in a minute.' }, 502)
  await rpc(c, 'id_check_start', { member: id, session: session.session_id })
  return json({ url: session.url, session_id: session.session_id })
}

async function update(c: Config, session: string): Promise<Response> {
  const owner = await rpc<string | null>(c, 'id_check_owner', { session })
  if (!owner) return json({ error: 'Unknown check.' }, 404)
  const res = await fetch(`${DIDIT}/session/${encodeURIComponent(session)}/decision/`, { headers: { 'x-api-key': c.didit } })
  if (!res.ok) return json({ error: 'The ID check isn’t answering. Please try again in a minute.' }, 502)
  const decision = (await res.json()) as Decision
  if (decision.vendor_data && decision.vendor_data !== owner) return json({ error: 'Unknown check.' }, 404)
  const status = outcome(decision)
  await rpc(c, 'id_check_result', { session, new_status: status })
  return json({ status })
}

export async function onRequest({ request, env }: Context): Promise<Response> {
  const c = config(env)
  if (request.method === 'GET') return json({ live: c !== null })
  if (request.method !== 'POST') return json({ error: 'Not allowed.' }, 405)
  if (!c) return json({ error: 'The ID check isn’t switched on yet.' }, 503)
  let body: { session_id?: unknown } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // Starting a check sends no body.
  }
  const session = typeof body.session_id === 'string' ? body.session_id.slice(0, 100) : null
  try {
    return session ? await update(c, session) : await start(c, request)
  } catch {
    return json({ error: 'Something went wrong. Please try again in a minute.' }, 500)
  }
}
