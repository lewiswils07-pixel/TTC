import { Link } from 'react-router'
import { CloseIcon, NextIcon } from './Icons'

/** Three things to try on your first day, as one slim bar showing the next one (testers, 13 Oct: the full checklist pushed people off screen). */
export function FirstDayGuide({ hasTrip, read, sent, onHide }: { hasTrip: boolean; read: boolean; sent: boolean; onHide: () => void }) {
  const steps = [
    { label: 'Add a trip', done: hasTrip, to: '/trips/new', hint: 'See who’s going when you are' },
    { label: 'Read someone’s profile', done: read, hint: 'Tap Read more on a card' },
    { label: 'Send a request to connect', done: sent, hint: 'Tap Connect on someone you like' },
  ]
  const done = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)
  const text = (
    <span className="first-day-text">
      <strong>{next ? next.label : 'You’re all set'}</strong>
      <span>{next ? next.hint : 'That’s the basics. Enjoy meeting people.'}</span>
    </span>
  )
  return (
    <section className="first-day" aria-labelledby="first-day-title">
      <h2 id="first-day-title" className="visually-hidden">
        Your first day
      </h2>
      <span className="first-day-count" style={{ ['--done' as string]: done / steps.length }} aria-label={`${done} of ${steps.length} done`}>
        {done}/{steps.length}
      </span>
      {next?.to ? (
        <Link className="first-day-main" to={next.to}>
          {text}
          <NextIcon />
        </Link>
      ) : (
        <span className="first-day-main">{text}</span>
      )}
      <button type="button" className="icon-btn first-day-hide" onClick={onHide} aria-label={next ? 'Hide your first-day tips' : 'Done'}>
        <CloseIcon size={18} />
      </button>
    </section>
  )
}
