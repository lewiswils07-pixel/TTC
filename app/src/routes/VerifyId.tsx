import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Layout } from '../components/Layout'
import { PageTop } from '../components/PageBack'
import { finishIdCheck, idCheckLive, idCheckWords, myIdCheck, startIdCheck, type IdCheck } from '../lib/idCheck'

/** "Check your ID": start a check, and the page Didit sends members back to. */
export function VerifyId() {
  const heading = useRef<HTMLHeadingElement>(null)
  const [params] = useSearchParams()
  const [check, setCheck] = useState<IdCheck | null>(null)
  const [live, setLive] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    heading.current?.focus()
    let alive = true
    const back = params.get('verificationSessionId') ?? params.get('session_id')
    const returned = back !== null || params.has('status')
    Promise.all([idCheckLive(), returned ? finishIdCheck(back) : null])
      .then(([on]) => Promise.all([on, myIdCheck()]))
      .then(([on, c]) => {
        if (!alive) return
        setLive(on)
        setCheck(c)
      })
    return () => {
      alive = false
    }
  }, [params])

  async function start() {
    setBusy(true)
    setError('')
    try {
      window.location.assign(await startIdCheck())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again in a minute.')
      setBusy(false)
    }
  }

  const words = idCheckWords(check)
  return (
    <Layout>
      <PageTop tag="ID check" fallback="/profile" />
      <h1 ref={heading} tabIndex={-1}>
        {words.title}
      </h1>
      <p className="lede">{words.text}</p>
      {live === null ? null : !live ? (
        <p className="card">ID checks are coming soon. We’ll let you know when you can check yours.</p>
      ) : words.canStart ? (
        <>
          <ul className="help-list">
            <li>Have your passport or driving licence with you.</li>
            <li>Find good light, without glare on the photo.</li>
            <li>Your ID photos go to our checking partner, Didit, not to other members. We only keep whether you passed.</li>
          </ul>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={start}>
            {busy ? 'Opening…' : check?.status === 'Declined' ? 'Try again' : 'Check my ID'}
          </button>
          {check?.triesLeft === 1 && <p className="hint">This is your last try this month.</p>}
        </>
      ) : null}
    </Layout>
  )
}
