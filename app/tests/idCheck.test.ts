import { afterEach, describe, expect, it, vi } from 'vitest'
import { ageOn, onRequest, outcome, type Env } from '../functions/api/id-check'
import { idCheckWords } from '../src/lib/idCheck'

const env: Env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service', DIDIT_API_KEY: 'didit', DIDIT_WORKFLOW_ID: 'wf' }
const post = (body?: unknown, headers: Record<string, string> = {}) =>
  new Request('https://app.test/api/id-check', { method: 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) })
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

afterEach(() => vi.unstubAllGlobals())

describe('ID check server', () => {
  it('says whether the check is switched on', async () => {
    expect(await (await onRequest({ request: new Request('https://app.test/api/id-check'), env: {} })).json()).toEqual({ live: false })
    expect(await (await onRequest({ request: new Request('https://app.test/api/id-check'), env })).json()).toEqual({ live: true })
  })

  it('never passes under-18s', () => {
    expect(ageOn('2000-06-15', new Date('2026-06-14'))).toBe(25)
    expect(ageOn('2000-06-15', new Date('2026-06-15'))).toBe(26)
    expect(outcome({ status: 'Approved', id_verifications: [{ date_of_birth: '2015-01-01' }] })).toBe('Declined')
    expect(outcome({ status: 'Approved', id_verification: { date_of_birth: '1980-01-01' } })).toBe('Approved')
    expect(outcome({ status: 'In Review' })).toBe('In Review')
  })

  it('starts a check for the signed-in member', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push(url)
      if (url.endsWith('/auth/v1/user')) return reply({ id: 'ann' })
      if (url.endsWith('/rpc/id_check_allowed')) return reply('ok')
      if (url.endsWith('/session/')) {
        expect(JSON.parse(String(init?.body))).toEqual({ workflow_id: 'wf', vendor_data: 'ann', callback: 'https://app.test/verify-id' })
        return reply({ session_id: 's1', url: 'https://didit.test/s1' })
      }
      if (url.endsWith('/rpc/id_check_start')) return new Response(null, { status: 204 })
      throw new Error(url)
    })
    const res = await onRequest({ request: post(undefined, { authorization: 'Bearer token' }), env })
    expect(await res.json()).toEqual({ url: 'https://didit.test/s1', session_id: 's1' })
    expect(calls.at(-1)).toBe('https://db.test/rest/v1/rpc/id_check_start')
  })

  it('refuses to start without signing in', async () => {
    vi.stubGlobal('fetch', async () => reply({}, 401))
    expect((await onRequest({ request: post(), env })).status).toBe(401)
  })

  it('records Didit’s own answer, not what was posted', async () => {
    let saved: unknown
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url.endsWith('/rpc/id_check_owner')) return reply('ann')
      if (url.endsWith('/decision/')) return reply({ status: 'Declined', vendor_data: 'ann' })
      if (url.endsWith('/rpc/id_check_result')) {
        saved = JSON.parse(String(init?.body))
        return new Response(null, { status: 204 })
      }
      throw new Error(url)
    })
    const res = await onRequest({ request: post({ session_id: 's1', status: 'Approved' }), env })
    expect(await res.json()).toEqual({ status: 'Declined' })
    expect(saved).toEqual({ session: 's1', new_status: 'Declined' })
  })

  it('ignores a check that belongs to someone else', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.endsWith('/rpc/id_check_owner')) return reply('ann')
      if (url.endsWith('/decision/')) return reply({ status: 'Approved', vendor_data: 'bob' })
      throw new Error(url)
    })
    expect((await onRequest({ request: post({ session_id: 's1' }), env })).status).toBe(404)
  })
})

describe('ID check words', () => {
  it('fits each state', () => {
    expect(idCheckWords({ verifiedAt: '2026-10-18', status: 'Approved', triesLeft: 2 }).canStart).toBe(false)
    expect(idCheckWords({ verifiedAt: null, status: 'Declined', triesLeft: 1 }).title).toBe('Your ID check didn’t pass')
    expect(idCheckWords({ verifiedAt: null, status: 'Declined', triesLeft: 0 }).canStart).toBe(false)
    expect(idCheckWords(null).canStart).toBe(true)
  })
})
