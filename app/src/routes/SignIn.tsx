import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { TextField } from '../components/Field'
import { PasswordField } from '../components/PasswordField'
import { CODE_LENGTH, hasPassword, MIN_PASSWORD, needsPasswordChoice, ReauthNeeded, sendCode, setPassword, signInWithPassword, skipPassword, verifyCode } from '../lib/auth'
import { messageOf } from '../lib/errors'
import { useSession } from '../lib/session-context'
import { useChecks } from '../lib/useChecks'
import { checkCode, checkEmail, checkNewPassword, checkPassword } from '../lib/validation'

const RESEND_SECONDS = 60
// Remembered on this device after the first sign-in, so returning members see "Sign in" first.
const KNOWN_KEY = 'sodalis.signedInBefore'

type Mode = 'signin' | 'join'
type Stage = 'start' | 'code' | 'password'
/** Why we emailed a code: to join, because they forgot their password, or because they prefer codes. */
type CodeReason = 'join' | 'forgot' | 'code'

function signedInBefore(): boolean {
  try {
    return localStorage.getItem(KNOWN_KEY) === '1'
  } catch {
    return false
  }
}

function rememberSignedIn(): void {
  try {
    localStorage.setItem(KNOWN_KEY, '1')
  } catch {
    // Private windows can refuse storage; they just see "Join" first next time.
  }
}

export function SignIn() {
  const { session, loading } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/connections'

  const [mode, setMode] = useState<Mode>(() => (signedInBefore() ? 'signin' : 'join'))
  const [stage, setStage] = useState<Stage>('start')
  // Signed in but never chose a password (or said Not now), e.g. after a refresh on that screen: ask now.
  const choosing = stage === 'password' || (!!session && needsPasswordChoice(session.user))
  const [reason, setReason] = useState<CodeReason>('join')
  const [email, setEmail] = useState('')
  const [password, setPasswordValue] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set when the server wants an emailed code before saving (it's been a while since they signed in).
  const [reauth, setReauth] = useState<string | null>(null)
  const [wait, setWait] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const errors = {
    email: stage === 'start' && !choosing ? checkEmail(email) : null,
    password: stage === 'start' && !choosing && mode === 'signin' ? checkPassword(password) : null,
    reauth: reauth === null ? null : checkCode(reauth),
    code: stage === 'code' ? checkCode(code) : null,
    newPassword: choosing ? checkNewPassword(newPassword) : null,
  }
  const { shown, touch, validateAll, reset } = useChecks(errors)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  useEffect(() => {
    heading.current?.focus()
  }, [stage, mode])

  if (loading) return <Loading />
  // Already signed in: carry on, unless they're choosing a password straight after their code.
  if (session && !choosing && !busy) return <Navigate to={from} replace />

  function go(next: Stage) {
    setStage(next)
    setError(null)
    reset()
  }

  function done() {
    rememberSignedIn()
    navigate(from, { replace: true })
  }

  async function notNow() {
    setBusy(true)
    await skipPassword()
    done()
  }

  async function requestCode(why: CodeReason) {
    if (checkEmail(email)) {
      touch('email')
      validateAll()
      return
    }
    setReason(why)
    setBusy(true)
    setError(null)
    try {
      await sendCode(email)
      go('code')
      setCode('')
      setWait(RESEND_SECONDS)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitStart(e: FormEvent) {
    e.preventDefault()
    if (mode === 'join') return requestCode('join')
    if (!validateAll()) return
    setBusy(true)
    setError(null)
    try {
      await signInWithPassword(email, password)
      done()
    } catch (err) {
      setError(messageOf(err))
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
      const signedIn = await verifyCode(email, digits)
      rememberSignedIn()
      if (reason === 'forgot' || !hasPassword(signedIn.user)) {
        go('password')
        setBusy(false)
      } else {
        done()
      }
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    if (!validateAll()) return
    setBusy(true)
    setError(null)
    try {
      await setPassword(newPassword, reauth ?? undefined)
      done()
    } catch (err) {
      if (err instanceof ReauthNeeded) setReauth('')
      else setError(messageOf(err))
      setBusy(false)
    }
  }

  const emailField = (
    <TextField
      name="email"
      label="Email address"
      type="email"
      inputMode="email"
      autoComplete={mode === 'signin' ? 'username' : 'email'}
      autoCapitalize="none"
      spellCheck={false}
      value={email}
      valid={!checkEmail(email)}
      error={shown('email') ?? (mode === 'join' ? error : null)}
      onChange={(e) => {
        setEmail(e.target.value)
        setError(null)
      }}
      onBlur={() => email && touch('email')}
    />
  )

  return (
    <Layout>
      <div className="auth">
        {stage === 'start' && (
          <form className="card form-card" onSubmit={submitStart} noValidate>
            <div className="subnav" role="group" aria-label="Join or sign in">
              {(['join', 'signin'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`subnav-item btn-plain${mode === m ? ' is-current' : ''}`}
                  aria-pressed={mode === m}
                  onClick={() => {
                    setMode(m)
                    setError(null)
                    reset()
                  }}
                >
                  {m === 'join' ? 'Join' : 'Sign in'}
                </button>
              ))}
            </div>
            <h1 ref={heading} tabIndex={-1}>
              {mode === 'join' ? 'Join the Collective' : 'Welcome back'}
            </h1>
            {mode === 'join' ? (
              <p className="lede">Enter your email and we’ll send you a {CODE_LENGTH}-digit code to check it’s you. Then you’ll choose a password.</p>
            ) : (
              <p className="lede">Sign in with your email and password. You’ll stay signed in on this device until you sign out.</p>
            )}
            {emailField}
            {mode === 'signin' && (
              <PasswordField
                name="password"
                label="Password"
                autoComplete="current-password"
                value={password}
                error={shown('password') ?? error}
                onChange={(e) => {
                  setPasswordValue(e.target.value)
                  setError(null)
                }}
              />
            )}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? (mode === 'join' ? 'Sending…' : 'Signing in…') : mode === 'join' ? 'Send my code' : 'Sign in'}
            </button>
            {mode === 'signin' && (
              <>
                <p className="auth-or">or</p>
                <div className="auth-links">
                  <button type="button" className="btn-link" disabled={busy} onClick={() => requestCode('forgot')}>
                    Forgotten your password?
                  </button>
                  <button type="button" className="btn-link" disabled={busy} onClick={() => requestCode('code')}>
                    Email me a code instead
                  </button>
                </div>
              </>
            )}
            <p className="hint center legal-line">
              By continuing you agree to our <Link to="/terms">terms</Link>, <Link to="/privacy">privacy notice</Link> and{' '}
              <Link to="/community-rules">community rules</Link>.
            </p>
          </form>
        )}

        {stage === 'code' && (
          <form className="card form-card" onSubmit={submitCode} noValidate>
            <h1 ref={heading} tabIndex={-1}>
              Check your email
            </h1>
            <p className="lede">
              We’ve sent a {CODE_LENGTH}-digit code to <strong>{email.trim()}</strong>. It can take a minute to arrive, and it’s worth checking your spam
              folder.
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
              {busy ? 'Checking…' : 'Continue'}
            </button>
            <div className="auth-links">
              <button type="button" className="btn-link" disabled={busy || wait > 0} onClick={() => requestCode(reason)}>
                {wait > 0 ? `Send a new code in ${wait} seconds` : 'Send a new code'}
              </button>
              <button type="button" className="btn-link" onClick={() => go('start')}>
                Use a different email
              </button>
            </div>
          </form>
        )}

        {choosing && (
          <form className="card form-card" onSubmit={savePassword} noValidate>
            <h1 ref={heading} tabIndex={-1}>
              {reason === 'forgot' ? 'Choose a new password' : 'Choose a password'}
            </h1>
            <p className="lede">Next time, sign in with your email and this password. You’ll stay signed in on this device until you sign out.</p>
            <input type="email" name="username" autoComplete="username" value={email.trim()} readOnly hidden />
            <PasswordField
              name="newPassword"
              label="Password"
              hint={`At least ${MIN_PASSWORD} characters. A short phrase is easy to remember and hard to guess.`}
              autoComplete="new-password"
              value={newPassword}
              error={shown('newPassword') ?? error}
              onChange={(e) => {
                setNewPassword(e.target.value)
                setError(null)
                if (shown('newPassword')) touch('newPassword')
              }}
              onBlur={() => newPassword && touch('newPassword')}
            />
            {reauth !== null && (
              <TextField
                name="reauth"
                label="Code from your email"
                hint={`To keep your account safe, we’ve emailed you a ${CODE_LENGTH}-digit code. Enter it to save your password.`}
                className="input input-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH + 2}
                value={reauth}
                error={shown('reauth')}
                onChange={(e) => {
                  setReauth(e.target.value)
                  setError(null)
                }}
                onBlur={() => reauth && touch('reauth')}
              />
            )}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </button>
            <div className="auth-links">
              <button type="button" className="btn-link" disabled={busy} onClick={notNow}>
                Not now, I’ll use emailed codes
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  )
}
