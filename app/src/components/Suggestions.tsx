import { useEffect, useRef, useState } from 'react'
import { requestsLeft, sendRequest } from '../lib/connections'
import { messageOf } from '../lib/errors'
import { homeLabel } from '../lib/matching'
import { ageLabel } from '../lib/options'
import { hasPlus, weeklyRequests } from '../lib/plan'
import { MAX_NOTE } from '../lib/validation'
import { Avatar } from './Avatar'
import { Field } from './Field'
import { SafetyBox } from './SafetyBox'

type Person = {
  profile_id: string
  display_name: string
  birth_year: number | null
  home_city: string | null
  home_country: string | null
  photo_path: string | null
  score: number
}

export type Requests = { left: number; limit: number; used: () => void }

/** How many connection requests the member has left this week, and their weekly limit. */
export function useRequests(): Requests | null {
  const [state, setState] = useState<{ left: number; limit: number } | null>(null)
  useEffect(() => {
    Promise.all([requestsLeft(), hasPlus()]).then(
      ([left, plus]) => setState({ left, limit: weeklyRequests(plus) }),
      () => setState({ left: 0, limit: weeklyRequests(false) }),
    )
  }, [])
  if (!state) return null
  return { ...state, used: () => setState((s) => s && { ...s, left: Math.max(0, s.left - 1) }) }
}

export function RequestsHint({ requests }: { requests: Requests }) {
  const { left, limit } = requests
  return (
    <p className="hint section-hint">
      Best fit first. You have {left} of {limit} requests left this week{left === 0 ? '; you get more on Monday' : ''}.
    </p>
  )
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
              {person.score}% in common
            </span>
          </div>
          <p className="profile-meta">
            {person.birth_year ? `Age ${ageLabel(person.birth_year)}` : null}
            {home && ` · ${home}`}
          </p>
        </div>
      </div>
      <ul className="match-reasons">
        {reasons.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <ConnectBox person={person} tripId={tripId} requests={requests} />
      <SafetyBox profileId={person.profile_id} name={person.display_name} onBlocked={setGone} />
    </li>
  )
}

function ConnectBox({ person, tripId, requests }: { person: Person; tripId?: number; requests: Requests }) {
  const [open, setOpen] = useState(false)
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
      setSent(true)
      requests.used()
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
        </p>
      )}
      <div className="action-row">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>
          {busy ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </div>
  )
}
