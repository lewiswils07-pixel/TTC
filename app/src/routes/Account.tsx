import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Layout, Monogram } from '../components/Layout'
import { deleteMyAccount, downloadMyData, signOutHere } from '../lib/account'
import { messageOf } from '../lib/errors'
import { useSession } from '../lib/session-context'

const CONFIRM_WORD = 'DELETE'

/** Download my data, and delete my account. */
export function Account() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<'download' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const confirmId = useId()

  useEffect(() => heading.current?.focus(), [])

  async function download() {
    setBusy('download')
    setError(null)
    try {
      await downloadMyData()
      setDownloaded(true)
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy('delete')
    setError(null)
    try {
      await deleteMyAccount(session!.user.id)
      navigate('/account-deleted', { replace: true })
    } catch (e) {
      setError(messageOf(e))
      setBusy(null)
    }
  }

  return (
    <Layout tab="profile">
      <Link className="back-link" to="/profile">
        ‹ My profile
      </Link>
      <h1 ref={heading} tabIndex={-1}>
        Your account and data
      </h1>
      <p className="lede">Signed in as {session?.user.email}.</p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      <section className="card section-card account-card" aria-labelledby="download-title">
        <h2 id="download-title">Download my data</h2>
        <p>A file with everything we hold about you: your profile, trips, connections, the messages you’ve sent and your settings.</p>
        <button type="button" className="btn btn-secondary btn-block" onClick={download} disabled={busy !== null}>
          {busy === 'download' ? 'Preparing…' : 'Download my data'}
        </button>
        {downloaded && (
          <p className="notice notice-success" role="status">
            Your file is downloading. Look in your Downloads folder.
          </p>
        )}
      </section>

      <section className="card section-card account-card account-danger" aria-labelledby="delete-title">
        <h2 id="delete-title">Delete my account</h2>
        <p>
          This removes your profile, photos, trips, connections and messages for good. People you’ve chatted with will no longer see your messages. If you
          started a group, another member takes it over. It can’t be undone.
        </p>
        {!deleting ? (
          <button type="button" className="btn btn-danger btn-block" onClick={() => setDeleting(true)}>
            Delete my account
          </button>
        ) : (
          <div className="delete-confirm">
            <label htmlFor={confirmId}>
              Type <strong>{CONFIRM_WORD}</strong> to confirm
            </label>
            <input
              id={confirmId}
              className="input"
              autoComplete="off"
              autoCapitalize="characters"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
            <div className="action-row">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy !== null}
                onClick={() => {
                  setDeleting(false)
                  setTyped('')
                }}
              >
                Keep my account
              </button>
              <button type="button" className="btn btn-danger" disabled={typed.trim().toUpperCase() !== CONFIRM_WORD || busy !== null} onClick={remove}>
                {busy === 'delete' ? 'Deleting…' : 'Delete for good'}
              </button>
            </div>
          </div>
        )}
      </section>
    </Layout>
  )
}

/** Shown once an account has been deleted (the member is signed out by then). */
export function AccountDeleted() {
  useEffect(() => {
    void signOutHere()
  }, [])
  return (
    <Layout>
      <section className="welcome">
        <Monogram size={72} />
        <h1>Your account has been deleted</h1>
        <p className="lede">Thank you for being part of the Collective. You’re welcome back any time.</p>
        <Link className="btn btn-secondary btn-block" to="/">
          Back to the start
        </Link>
      </section>
    </Layout>
  )
}
