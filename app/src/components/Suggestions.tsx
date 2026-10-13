import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { keep, peek, remember } from '../lib/cache'
import { sendRequest } from '../lib/connections'
import { messageOf } from '../lib/errors'
import { stepLink } from '../lib/onboarding'
import { loadRequests, PLUS_SHOW_LEFT_BELOW, weeklyRequests } from '../lib/plan'
import { MAX_NOTE } from '../lib/validation'
import { Field } from './Field'

/** Every interest two members share, as tags (Lewis, 5 Oct: show them all). */
export function SharedInterests({ labels }: { labels: string[] }) {
  return (
    <div className="shared-interests">
      <h4>Interests you share</h4>
      <ul className="chip-list">
        {labels.map((label) => (
          <li key={label} className="tag tag-shared">
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}

type Person = {
  profile_id: string
  display_name: string
  birth_year: number | null
  home_city: string | null
  home_country: string | null
  photo_path: string | null
  travelling_with: string | null
  score: number
  shared_interests?: string[]
}

export type Requests = { left: number; limit: number; plus: boolean; used: () => void }

/** How many connection requests the member has left this week, and their weekly limit. */
export function useRequests(): Requests | null {
  const [state, setState] = useState<{ left: number; limit: number; plus: boolean } | null>(() => peek('requests') ?? null)
  useEffect(() => {
    remember('requests', loadRequests()).then(setState, () => setState({ left: 0, limit: weeklyRequests(false), plus: false }))
  }, [])
  if (!state) return null
  return {
    ...state,
    used: () =>
      setState((s) => {
        const next = s && { ...s, left: Math.max(0, s.left - 1) }
        keep('requests', next)
        return next
      }),
  }
}

/** "Connect": a connection request with a note. On Who's going it opens straight away and hands back to the row when sent or cancelled. */
export function ConnectBox({
  person,
  tripId,
  requests,
  startOpen = false,
  needsPhoto = false,
  suggested = '',
  onSent,
  onCancel,
}: {
  person: Pick<Person, 'profile_id' | 'display_name'>
  tripId?: number
  requests: Requests
  startOpen?: boolean
  /** You have no photo yet, so ask for one before they write a note (testers, 13 Oct). */
  needsPhoto?: boolean
  /** A first line tied to the trip, which they can change. */
  suggested?: string
  onSent?: (connected: boolean) => void
  onCancel?: () => void
}) {
  const [open, setOpen] = useState(startOpen)
  const [note, setNote] = useState(suggested.slice(0, MAX_NOTE))
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<'sent' | 'connected' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const noteBox = useRef<HTMLTextAreaElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const here = useLocation()
  const { left } = requests

  useEffect(() => {
    if (!open) return
    // Bring the whole box into view, buttons included, so nothing sits under the tab bar.
    noteBox.current?.focus({ preventScroll: true })
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [open])

  if (sent) {
    return (
      <p className="notice notice-success" role="status">
        {sent === 'connected' ? (
          <>
            {person.display_name} had already asked to connect with you, so you’re now connected. <Link to="/messages">Say hello in Chat</Link>
          </>
        ) : (
          `Request sent. We’ll let you know when ${person.display_name} replies.`
        )}
      </p>
    )
  }
  if (!open) {
    return (
      <button type="button" className="btn btn-primary btn-block" disabled={left <= 0} onClick={() => setOpen(true)}>
        {left > 0 ? `Connect with ${person.display_name}` : 'No requests left this week'}
      </button>
    )
  }

  if (needsPhoto) {
    return (
      <div className="connect-box connect-photo" ref={box}>
        <p>
          <strong>Add a photo first.</strong> Members only accept requests from people they can see. It takes a minute, and we’ll bring you back here.
        </p>
        <div className="action-row">
          <button type="button" className="btn btn-secondary" onClick={() => (onCancel ? onCancel() : setOpen(false))}>
            Not yet
          </button>
          <Link className="btn btn-primary" to={stepLink('photo', here.pathname + here.search)}>
            Add a photo
          </Link>
        </div>
      </div>
    )
  }

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const { connected } = await sendRequest(person.profile_id, note, tripId)
      if (!connected) requests.used()
      if (onSent) return onSent(connected)
      setSent(connected ? 'connected' : 'sent')
    } catch (e) {
      setError(messageOf(e))
      setBusy(false)
    }
  }

  return (
    <div className="connect-box" ref={box}>
      <Field name="note" label={`Your note to ${person.display_name}`} hint={`Change it as you like. ${MAX_NOTE - note.length} characters left.`}>
        {({ id, describedBy }) => (
          <textarea ref={noteBox} id={id} className="textarea textarea-short" maxLength={MAX_NOTE} aria-describedby={describedBy} value={note} onChange={(e) => setNote(e.target.value)} />
        )}
      </Field>
      <p className="hint">
        {requests.plus && left > PLUS_SHOW_LEFT_BELOW ? '' : `This uses 1 of your ${left} request${left === 1 ? '' : 's'} left this week. `}
        You can chat once they accept.
      </p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
          {/photo/i.test(error) && (
            <>
              {' '}
              <Link to={stepLink('photo')}>Add a photo</Link>
            </>
          )}
        </p>
      )}
      <div className="action-row">
        <button type="button" className="btn btn-secondary" onClick={() => (onCancel ? onCancel() : setOpen(false))} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>
          {busy ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </div>
  )
}
