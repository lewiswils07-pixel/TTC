import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Layout, Monogram } from '../components/Layout'
import { TextField } from '../components/Field'
import { PasswordField } from '../components/PasswordField'
import { deleteMyAccount, downloadMyData, signOutHere } from '../lib/account'
import { CODE_LENGTH, hasPassword, MIN_PASSWORD, ReauthNeeded, setPassword } from '../lib/auth'
import { messageOf } from '../lib/errors'
import { useSession } from '../lib/session-context'
import { useChecks } from '../lib/useChecks'
import { checkCode, checkNewPassword } from '../lib/validation'

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
      navigate('/account-deleted', { replace: true, state: { deleted: true } })
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

      <PasswordCard email={session?.user.email ?? ''} had={hasPassword(session?.user)} />

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

/** Choose or change the password used to sign in. */
function PasswordCard({ email, had }: { email: string; had: boolean }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // Set when the server wants the emailed code first.
  const [code, setCode] = useState<string | null>(null)
  const { shown, touch, validateAll, reset } = useChecks({ password: checkNewPassword(value), code: code === null ? null : checkCode(code) })

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!validateAll()) return
    setBusy(true)
    setError(null)
    try {
      await setPassword(value, code ?? undefined)
      setSaved(true)
      setValue('')
      setCode(null)
      reset()
    } catch (err) {
      if (err instanceof ReauthNeeded) setCode('')
      else setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card section-card account-card" aria-labelledby="password-title" onSubmit={save} noValidate>
      <h2 id="password-title">{had || saved ? 'Change your password' : 'Choose a password'}</h2>
      <p>{had || saved ? 'You sign in with your email and password.' : 'Sign in with a password instead of waiting for an emailed code.'} You stay signed in on each device until you sign out.</p>
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <PasswordField
        name="password"
        label={had || saved ? 'New password' : 'Password'}
        hint={`At least ${MIN_PASSWORD} characters.`}
        autoComplete="new-password"
        value={value}
        error={shown('password') ?? error}
        onChange={(e) => {
          setValue(e.target.value)
          setSaved(false)
          setError(null)
          if (shown('password')) touch('password')
        }}
        onBlur={() => value && touch('password')}
      />
      {code !== null && (
        <TextField
          name="code"
          label="Code from your email"
          hint={`To keep your account safe, we’ve emailed you a ${CODE_LENGTH}-digit code. Enter it to save your new password.`}
          className="input input-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH + 2}
          value={code}
          error={shown('code')}
          onChange={(e) => {
            setCode(e.target.value)
            setError(null)
          }}
          onBlur={() => code && touch('code')}
        />
      )}
      <button type="submit" className="btn btn-secondary btn-block" disabled={busy}>
        {busy ? 'Saving…' : 'Save password'}
      </button>
      {saved && (
        <p className="notice notice-success" role="status">
          Password saved. Use it next time you sign in.
        </p>
      )}
    </form>
  )
}

/** Shown once an account has been deleted (the member is signed out by then). */
export function AccountDeleted() {
  // Only reachable straight after deleting, so a link here can't sign anyone out.
  const deleted = (useLocation().state as { deleted?: boolean } | null)?.deleted === true
  useEffect(() => {
    if (deleted) void signOutHere()
  }, [deleted])
  if (!deleted) return <Navigate to="/" replace />
  return (
    <Layout>
      <section className="welcome">
        <Monogram size={72} />
        <h1>Your account has been deleted</h1>
        <p className="lede">Thank you for being part of the Collective. You’re welcome back any time.</p>
        <Link className="btn btn-secondary btn-block" to="/">
          Go to the home page
        </Link>
      </section>
    </Layout>
  )
}
