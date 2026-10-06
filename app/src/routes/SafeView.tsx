import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { Layout, Loading, Monogram } from '../components/Layout'
import { messageOf } from '../lib/errors'
import { describePerson, meetTime, viewShare, type SharedMeetup } from '../lib/share'

const REFRESH_MS = 60_000

/** The page a trusted contact opens from a member's link. No sign-in needed. */
export function SafeView() {
  const token = useParams().token ?? ''
  const [share, setShare] = useState<SharedMeetup | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  const load = useCallback(
    () =>
      viewShare(token).then(
        (s) => {
          setShare(s)
          setError(null)
        },
        (e) => setError(messageOf(e)),
      ),
    [token],
  )

  useEffect(() => {
    void load().then(() => heading.current?.focus())
    // Keep the check-in up to date while the page is open.
    const timer = setInterval(() => void load(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  if (share === undefined && !error) return <Loading />

  if (!share) {
    return (
      <Layout>
        <section className="welcome">
          <Monogram size={56} />
          <h1 ref={heading} tabIndex={-1}>
            {error ? 'We couldn’t load this page' : 'This link has ended'}
          </h1>
          {error ? (
            <>
              <p className="notice notice-error" role="alert">
                {error}
              </p>
              <button type="button" className="btn btn-primary" onClick={() => void load()}>
                Try again
              </button>
            </>
          ) : (
            <p className="lede">Links stop working two days after the meet-up, or when the member stops sharing. If you’re worried, contact them directly.</p>
          )}
        </section>
      </Layout>
    )
  }

  const name = share.member
  return (
    <Layout>
      <p className="eyebrow">Shared privately with you</p>
      <h1 ref={heading} tabIndex={-1}>
        {name}’s meet-up
      </h1>
      <p className="lede">{name} is meeting someone they met on Sodalis Collective, a members’ community for people who like to travel with company, and wanted you to know.</p>

      {share.checked_in_at ? (
        <p className="notice notice-success safe-status" role="status">
          <strong>{name} is back safe.</strong> They checked in at {new Date(share.checked_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.
        </p>
      ) : (
        <p className="notice safe-status safe-waiting" role="status">
          {name} hasn’t checked in yet. They’ll tap “I’m back safe” when they’re home, and this page will update.
        </p>
      )}

      <dl className="card safe-details">
        <div>
          <dt>Who</dt>
          <dd>
            {share.meeting_with.length ? (
              <ul className="plain-list">
                {share.meeting_with.map((p, i) => (
                  <li key={i}>{describePerson(p)}</li>
                ))}
              </ul>
            ) : (
              'A member of the Collective'
            )}
          </dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>{share.place}</dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>{meetTime(share.meet_at)}</dd>
        </div>
        {share.note && (
          <div>
            <dt>{name} says</dt>
            <dd>“{share.note}”</dd>
          </div>
        )}
      </dl>

      <section className="card emergency" aria-labelledby="worried-title">
        <h2 id="worried-title">If you’re worried</h2>
        <p>Try calling or texting {name} first. If you can’t reach them and think they’re in danger, call the police on 999 in the UK, or 112 anywhere in Europe.</p>
        <p className="hint">Tell them who {name} was meeting, using the details above.</p>
      </section>
      <p className="hint center">This page stops working two days after the meet-up. Please don’t share the link further.</p>
    </Layout>
  )
}
