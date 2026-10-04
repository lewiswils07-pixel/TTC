import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { CODE_LENGTH, isValidEmail, sendCode, verifyCode } from '../lib/auth'
import { messageOf } from '../lib/errors'
import { useSession } from '../lib/session-context'

const RESEND_SECONDS = 60

export function SignIn() {
  const { session, loading } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  useEffect(() => {
    heading.current?.focus()
  }, [stage])

  if (loading) return <Loading />
  if (session && !busy) return <Navigate to={from} replace />

  async function requestCode(e?: FormEvent) {
    e?.preventDefault()
    if (!isValidEmail(email)) {
      setError('Please enter your email address, for example jane@example.com.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await sendCode(email)
      setStage('code')
      setCode('')
      setWait(RESEND_SECONDS)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault()
    const digits = code.replace(/\D/g, '')
    if (digits.length !== CODE_LENGTH) {
      setError(`Please enter the ${CODE_LENGTH}-digit code from the email.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await verifyCode(email, digits)
      navigate(from, { replace: true })
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }

  const errorId = error ? 'signin-error' : undefined

  return (
    <Layout>
      {stage === 'email' ? (
        <form onSubmit={requestCode} noValidate>
          <h1 ref={heading} tabIndex={-1}>
            Join or sign in
          </h1>
          <p>Enter your email and we'll send you a {CODE_LENGTH}-digit code. There's no password to remember.</p>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={errorId}
            />
          </div>
          {error && (
            <p className="error" id={errorId} role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send my code'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitCode} noValidate>
          <h1 ref={heading} tabIndex={-1}>
            Check your email
          </h1>
          <p>
            We've sent a {CODE_LENGTH}-digit code to <strong>{email.trim()}</strong>. It can take a minute to arrive, and
            it's worth checking your spam folder.
          </p>
          <div className="field">
            <label htmlFor="code">Your code</label>
            <input
              id="code"
              className="input input-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LENGTH + 2}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={errorId}
            />
          </div>
          {error && (
            <p className="error" id={errorId} role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
          </div>
          <p className="center">
            <button type="button" className="btn-link" disabled={busy || wait > 0} onClick={() => requestCode()}>
              {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
            </button>
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setStage('email')
                setError(null)
              }}
            >
              Use a different email
            </button>
          </p>
        </form>
      )}
    </Layout>
  )
}
