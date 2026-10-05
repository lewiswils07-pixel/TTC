import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { TextField } from '../components/Field'
import { CODE_LENGTH, sendCode, verifyCode } from '../lib/auth'
import { messageOf } from '../lib/errors'
import { useSession } from '../lib/session-context'
import { useChecks } from '../lib/useChecks'
import { checkCode, checkEmail } from '../lib/validation'

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
  const errors = { email: checkEmail(email), code: stage === 'code' ? checkCode(code) : null }
  const { shown, touch, validateAll } = useChecks(errors)

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
    if (errors.email) {
      validateAll()
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
    if (!validateAll()) return
    await verify(code.replace(/\D/g, ''))
  }

  // Signs in as soon as the last digit is typed or pasted.
  async function verify(digits: string) {
    if (busy) return
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

  return (
    <Layout>
      <div className="auth">
        {stage === 'email' ? (
          <form className="card form-card" onSubmit={requestCode} noValidate>
            <h1 ref={heading} tabIndex={-1}>
              Join or sign in
            </h1>
            <p className="lede">Enter your email and we’ll send you a {CODE_LENGTH}-digit code. There’s no password to remember.</p>
            <TextField
              name="email"
              label="Email address"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              valid={!errors.email}
              error={shown('email') ?? error}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(null)
              }}
              onBlur={() => email && touch('email')}
            />
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send my code'}
            </button>
            <p className="hint center legal-line">
              By continuing you agree to our <Link to="/terms">terms</Link>, <Link to="/privacy">privacy notice</Link> and{' '}
              <Link to="/community-rules">community rules</Link>.
            </p>
          </form>
        ) : (
          <form className="card form-card" onSubmit={submitCode} noValidate>
            <h1 ref={heading} tabIndex={-1}>
              Check your email
            </h1>
            <p className="lede">
              We’ve sent a {CODE_LENGTH}-digit code to <strong>{email.trim()}</strong>. It can take a minute to arrive, and
              it’s worth checking your spam folder.
            </p>
            <TextField
              name="code"
              label="Your code"
              className="input input-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LENGTH + 2}
              value={code}
              error={shown('code') ?? error}
              onChange={(e) => {
                const v = e.target.value
                setCode(v)
                setError(null)
                const digits = v.replace(/\D/g, '')
                if (digits.length === CODE_LENGTH && !/[^\d\s]/.test(v)) void verify(digits)
                else if (digits.length > CODE_LENGTH || /[^\d\s]/.test(v)) touch('code')
              }}
              onBlur={() => code && touch('code')}
            />
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <div className="auth-links">
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
            </div>
          </form>
        )}
      </div>
    </Layout>
  )
}
