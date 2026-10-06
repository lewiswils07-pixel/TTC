import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { keep, peek, remember } from '../lib/cache'
import { sendRequest } from '../lib/connections'
import { messageOf } from '../lib/errors'
import { stepLink } from '../lib/onboarding'
import { fitWords, homeLabel } from '../lib/matching'
import { ageLabel } from '../lib/options'
import { loadRequests, requestsLeftText, weeklyRequests } from '../lib/plan'
import { MAX_NOTE } from '../lib/validation'
import { Avatar } from './Avatar'
import { Field } from './Field'
import { SafetyBox } from './SafetyBox'

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

export function RequestsHint({ requests }: { requests: Requests }) {
  return <p className="hint section-hint">Best matches first. {requestsLeftText(requests)}</p>
}

/** One suggested member: who they are, why we think you'd get on, and Ask to connect. */
export function SuggestionCard({ person, reasons, tripId, requests }: { person: Person; reasons: string[]; tripId?: number; requests: Requests }) {
  const [gone, setGone] = useState<string | null>(null)
  const home = homeLabel(person)
  if (gone) {
    return (
      <li className="card">
        <p className="notice notice-success" role="status">
          {gone}
        </p>
      </li>
    )
  }
  return (
    <li className="card match-card">
      <div className="match-head">
        <Avatar name={person.display_name} path={person.photo_path} />
        <div className="match-who">
          <div className="match-name">
            <h3>{person.display_name}</h3>
            <span className="match-score" title="How well your interests, dates and travel style line up">
              {fitWords(person.score)}
            </span>
          </div>
          <p className="profile-meta">
            {person.birth_year ? `Age ${ageLabel(person.birth_year)}` : null}
            {home && ` · ${home}`}
          </p>
          {person.travelling_with && <p className="profile-meta">Travels with: {person.travelling_with}</p>}
        </div>
      </div>
      <ul className="match-reasons">
        {reasons.filter((line) => !line.startsWith('Both into')).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {!!person.shared_interests?.length && <SharedInterests labels={person.shared_interests} />}
      <ConnectBox person={person} tripId={tripId} requests={requests} />
      <SafetyBox profileId={person.profile_id} name={person.display_name} onBlocked={setGone} />
    </li>
  )
}

/** "Ask to connect" with an optional note. In the For you feed it opens straight away and hands back to the card when sent or cancelled. */
export function ConnectBox({
  person,
  tripId,
  requests,
  startOpen = false,
  onSent,
  onCancel,
}: {
  person: Pick<Person, 'profile_id' | 'display_name'>
  tripId?: number
  requests: Requests
  startOpen?: boolean
  onSent?: () => void
  onCancel?: () => void
}) {
  const [open, setOpen] = useState(startOpen)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const noteBox = useRef<HTMLTextAreaElement>(null)
  const { left } = requests

  useEffect(() => {
    if (open) noteBox.current?.focus()
  }, [open])

  if (sent) {
    return (
      <p className="notice notice-success" role="status">
        Request sent. We’ll let you know when {person.display_name} replies.
      </p>
    )
  }
  if (!open) {
    return (
      <button type="button" className="btn btn-primary btn-block" disabled={left <= 0} onClick={() => setOpen(true)}>
        {left > 0 ? `Ask to connect with ${person.display_name}` : 'No requests left this week'}
      </button>
    )
  }

  async function send() {
    setBusy(true)
    setError(null)
    try {
      await sendRequest(person.profile_id, note, tripId)
      requests.used()
      if (onSent) return onSent()
      setSent(true)
    } catch (e) {
      setError(messageOf(e))
      setBusy(false)
    }
  }

  return (
    <div className="connect-box">
      <Field
        name="note"
        label={`Add a note for ${person.display_name} (optional)`}
        hint={`Say hello and what you’d like to do together. ${MAX_NOTE - note.length} characters left.`}
      >
        {({ id, describedBy }) => (
          <textarea
            ref={noteBox}
            id={id}
            className="textarea textarea-short"
            maxLength={MAX_NOTE}
            aria-describedby={describedBy}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </Field>
      <p className="hint">
        This uses 1 of your {left} request{left === 1 ? '' : 's'} left this week. Nothing else is shared until they say yes.
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
