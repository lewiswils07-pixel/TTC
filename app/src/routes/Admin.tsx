import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { SubNav } from '../components/SubNav'
import { ADMIN_NAV } from '../lib/nav'
import {
  ACTION_LABELS,
  adminAct,
  adminLog,
  adminQueue,
  iAmAdmin,
  pausedMembers,
  reasonLabel,
  type AdminAction,
  type LogEntry,
  type PausedMember,
  type QueueItem,
} from '../lib/admin'
import { messageTime } from '../lib/chat'
import { messageOf } from '../lib/errors'

type Data = { queue: QueueItem[]; paused: PausedMember[]; log: LogEntry[] }

/** Reports and flagged messages to review, paused members, and every action taken. Admins only. */
export function Admin() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  const load = useCallback(
    () =>
      Promise.all([adminQueue(), pausedMembers(), adminLog()]).then(
        ([queue, paused, log]) => setData({ queue, paused, log }),
        (e) => setError(messageOf(e)),
      ),
    [],
  )

  useEffect(() => {
    iAmAdmin().then((yes) => {
      setAllowed(yes)
      if (yes) void load()
    })
  }, [load])

  useEffect(() => {
    if (data) heading.current?.focus()
  }, [data])

  function acted(message: string) {
    setDone(message)
    setError(null)
    void load()
  }

  if (allowed === false) {
    return (
      <Layout>
        <h1>Review</h1>
        <p className="lede">This page is only for the Sodalis team.</p>
        <Link className="btn btn-secondary" to="/profile">
          Back to my profile
        </Link>
      </Layout>
    )
  }
  if (!data && !error) return <Loading />

  return (
    <Layout>
      <Link className="back-link" to="/profile">
        ‹ My profile
      </Link>
      <h1 ref={heading} tabIndex={-1}>
        Review
      </h1>
      <SubNav label="Team" items={ADMIN_NAV} current="/admin" />
      <p className="lede">Reports and flagged messages, oldest first. Warn, suspend or remove closes everything open about that member.</p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="notice notice-success" role="status">
          {done}
        </p>
      )}

      {data && (
        <>
          <h2 className="section-title">To review{data.queue.length ? ` (${data.queue.length})` : ''}</h2>
          {data.queue.length === 0 ? (
            <p className="hint section-hint">Nothing to review. 🎉</p>
          ) : (
            <ul className="person-list">
              {data.queue.map((item) => (
                <QueueCard key={`${item.kind}-${item.id}`} item={item} onDone={acted} />
              ))}
            </ul>
          )}

          <h2 className="section-title">Paused members</h2>
          {data.paused.length === 0 ? (
            <p className="hint section-hint">No one is suspended or removed.</p>
          ) : (
            <ul className="person-list">
              {data.paused.map((p) => (
                <PausedCard key={p.profile_id} member={p} onDone={acted} />
              ))}
            </ul>
          )}

          <h2 className="section-title">Recent actions</h2>
          {data.log.length === 0 ? (
            <p className="hint section-hint">No actions yet.</p>
          ) : (
            <ol className="admin-log">
              {data.log.map((entry) => (
                <li key={entry.id}>
                  <span>
                    <strong>{ACTION_LABELS[entry.action]}</strong> {entry.subject_name ?? 'a removed member'}
                    {entry.note && <span className="hint"> · “{entry.note}”</span>}
                  </span>
                  <span className="hint">
                    {entry.admin_name ?? 'Admin'} · {messageTime(entry.created_at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Layout>
  )
}

const ACTIONS: { action: Exclude<AdminAction, 'reinstate'>; label: string; explain: string }[] = [
  { action: 'dismiss', label: 'Dismiss', explain: 'Closes this item only. Nothing is sent to the member.' },
  { action: 'warn', label: 'Warn', explain: 'Shows your note on their profile page, and closes everything open about them.' },
  { action: 'suspend', label: 'Suspend', explain: 'Hides them from everyone and stops them sending requests or messages. Their connections end. You can reinstate them later.' },
  { action: 'remove', label: 'Remove', explain: 'Closes their account for good. Their connections end.' },
]

function QueueCard({ item, onDone }: { item: QueueItem; onDone: (message: string) => void }) {
  const name = item.subject_name ?? 'A removed member'
  return (
    <li className="card queue-card">
      <div className="queue-head">
        <span className={`tag ${item.kind === 'flag' ? 'tag-flag' : 'tag-report'}`}>{item.kind === 'flag' ? 'Flagged message' : 'Report'}</span>
        <span className="hint">{messageTime(item.created_at)}</span>
      </div>
      <h3>
        {name}
        {item.subject_status && item.subject_status !== 'active' && <span className="hint"> ({item.subject_status === 'deleted' ? 'removed' : item.subject_status})</span>}
      </h3>
      <p className="hint">
        {item.reporter_name ? `Reported by ${item.reporter_name}` : 'Caught by the scam guard'}
        {' · '}
        {item.open_reports} open {item.open_reports === 1 ? 'report' : 'reports'}
        {item.past_actions > 0 && ` · ${item.past_actions} past ${item.past_actions === 1 ? 'action' : 'actions'}`}
        {item.subject_joined && ` · joined ${new Date(item.subject_joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
      </p>
      <ul className="chip-list">
        {item.reasons.map((r) => (
          <li key={r} className="tag">
            {reasonLabel(r)}
          </li>
        ))}
      </ul>
      {item.message_body && <blockquote className="person-note">“{item.message_body}”</blockquote>}
      {item.details && <p className="queue-details">{item.details}</p>}
      <ActionBox
        name={name}
        actions={item.subject_id ? ACTIONS : ACTIONS.filter((a) => a.action === 'dismiss')}
        run={(action, note) => adminAct(item.kind, item.id, action, note)}
        onDone={onDone}
      />
    </li>
  )
}

function PausedCard({ member, onDone }: { member: PausedMember; onDone: (message: string) => void }) {
  const name = member.display_name ?? 'Member'
  return (
    <li className="card queue-card">
      <h3>
        {name} <span className="hint">({member.status === 'deleted' ? 'removed' : 'suspended'})</span>
      </h3>
      <ActionBox
        name={name}
        actions={[{ action: 'reinstate', label: 'Reinstate', explain: 'Makes their account active again. Connections that ended stay ended.' }]}
        run={(action, note) => adminAct('member', member.profile_id, action, note)}
        onDone={onDone}
      />
    </li>
  )
}

/** A row of action buttons; picking one asks for an optional note, then confirms. */
function ActionBox({
  name,
  actions,
  run,
  onDone,
}: {
  name: string
  actions: { action: AdminAction; label: string; explain: string }[]
  run: (action: AdminAction, note: string) => Promise<void>
  onDone: (message: string) => void
}) {
  const [picked, setPicked] = useState<AdminAction | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const box = useRef<HTMLTextAreaElement>(null)
  const chosen = actions.find((a) => a.action === picked)

  useEffect(() => {
    if (picked) box.current?.focus()
  }, [picked])

  async function confirm() {
    if (!picked) return
    setBusy(true)
    setError(null)
    try {
      await run(picked, note)
      onDone(`${ACTION_LABELS[picked]}: ${name}.`)
    } catch (e) {
      setError(messageOf(e))
      setBusy(false)
    }
  }

  if (!chosen) {
    return (
      <div className="admin-actions">
        {actions.map((a) => (
          <button key={a.action} type="button" className={`btn btn-small ${a.action === 'remove' ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setPicked(a.action)}>
            {a.label}
          </button>
        ))}
      </div>
    )
  }

  const toMember = picked === 'warn' || picked === 'suspend' || picked === 'remove' || picked === 'reinstate'
  return (
    <div className="safety-box">
      <p>
        <strong>
          {chosen.label} {name}?
        </strong>{' '}
        {chosen.explain}
      </p>
      <div className="field">
        <label htmlFor={`${id}-note`}>{toMember ? `Note to ${name} (optional)` : 'Note for the log (optional)'}</label>
        <textarea ref={box} id={`${id}-note`} className="textarea textarea-short" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        {toMember && <p className="hint">They see this on their profile page.</p>}
      </div>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="action-row">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setPicked(null)}>
          Cancel
        </button>
        <button type="button" className={`btn ${picked === 'remove' || picked === 'suspend' ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={confirm}>
          {busy ? 'Saving…' : chosen.label}
        </button>
      </div>
    </div>
  )
}
