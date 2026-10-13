import { Link } from 'react-router'

/** Three things to try on your first day. Each ticks off as it happens; the last tick says you're all set. */
export function FirstDayGuide({ hasTrip, read, sent, onHide }: { hasTrip: boolean; read: boolean; sent: boolean; onHide: () => void }) {
  const steps = [
    { label: 'Add a trip', done: hasTrip, to: '/trips/new' },
    { label: 'Read someone’s card', done: read, hint: 'Tap Read more or Their answers' },
    { label: 'Send a request to connect', done: sent, hint: 'Tap Connect on someone you like' },
  ]
  const left = steps.filter((s) => !s.done).length
  return (
    <section className="card first-day" aria-labelledby="first-day-title">
      <div className="first-day-head">
        <h2 id="first-day-title">{left ? 'Your first day' : 'You’re all set'}</h2>
        <button type="button" className="btn-link" onClick={onHide}>
          {left ? 'Hide' : 'Done'}
        </button>
      </div>
      <p className="hint">{left ? `Three things to try. ${left === 3 ? 'Each one ticks off as you go.' : `${left} to go.`}` : 'That’s the basics. Enjoy meeting people.'}</p>
      <ol className="check-list">
        {steps.map((s) => (
          <li key={s.label} className={s.done ? 'is-done' : undefined}>
            <span className="check-mark" aria-hidden="true" />
            {s.done ? (
              <span>
                {s.label}
                <span className="visually-hidden"> (done)</span>
              </span>
            ) : s.to ? (
              <Link to={s.to}>{s.label}</Link>
            ) : (
              <span>
                {s.label}
                <span className="first-day-hint">{s.hint}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
