import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Layout, Monogram } from '../components/Layout'
import { HEARD_FROM, saveHeardFrom, type HeardFrom } from '../lib/kpis'
import { useSession } from '../lib/session-context'
import { brand } from '../lib/brand'
import { longDate } from '../lib/dates'
import { count, rules } from '../lib/rules'
import { supabase } from '../lib/supabase'

type Welcome = { member_number: number | null; plus_until: string | null }

/** Shown once, straight after a member finishes sign-up. */
export function WelcomeScreen() {
  const [welcome, setWelcome] = useState<Welcome | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
    supabase
      .rpc('my_welcome')
      .single<Welcome>()
      .then(({ data }) => setWelcome(data ?? { member_number: null, plus_until: null }))
  }, [])

  return (
    <Layout>
      <section className="welcome">
        <Monogram size={88} />
        <p className="eyebrow gold-rule">{brand.name}</p>
        <h1 ref={heading} tabIndex={-1}>
          Welcome to the Collective
        </h1>
        {welcome?.member_number ? (
          <p className="member-number" aria-live="polite">
            You’re founding member <strong>No. {welcome.member_number}</strong>
          </p>
        ) : (
          <p className="member-number">You’re one of our founding members.</p>
        )}
        <div className="card welcome-gift">
          <h2>{count(rules.founding.plusMonths, 'month')} of {brand.plusName}, on us</h2>
          <p>
            As a thank-you for joining early: {rules.requests.perWeekPlus} connection requests a week, up to {count(rules.groups.maxOwnedPlus, 'group')} and extra filters
            {welcome?.plus_until ? `, until ${longDate(welcome.plus_until.slice(0, 10))}` : ''}. Nothing to pay, and no card needed.
          </p>
        </div>
        <ol className="how-it-works">
          <li>
            <strong>See people you’d get on with</strong>, one at a time, with why we think you’d click.
          </li>
          <li>
            <strong>Say hello</strong> with Connect. Nothing more is shared until you both say yes.
          </li>
          <li>
            <strong>Plan together</strong> in chat. Adding a trip is optional, and shows you people going too.
          </li>
        </ol>
        <HeardFromQuestion />
        <Link className="btn btn-primary btn-block btn-lg" to="/connections?tour=1">
          Start meeting people
        </Link>
        <Link className="btn btn-secondary btn-block" to="/trips/new">
          Add a trip (optional)
        </Link>
      </section>
    </Layout>
  )
}

/** One optional tap: where the member heard about us (for the team's sign-ups by channel). */
function HeardFromQuestion() {
  const { session } = useSession()
  const [chosen, setChosen] = useState<HeardFrom | null>(null)
  const [hidden, setHidden] = useState(false)

  async function pick(value: HeardFrom) {
    setChosen(value)
    // Older databases don't have the question yet: just hide it.
    await saveHeardFrom(session!.user.id, value).catch(() => setHidden(true))
  }

  if (hidden) return null
  return (
    <fieldset className="heard-from">
      <legend>Where did you hear about us? (optional)</legend>
      {chosen ? (
        <p className="hint" role="status">
          Thank you.
        </p>
      ) : (
        <div className="pill-row">
          {HEARD_FROM.map((o) => (
            <button key={o.value} type="button" className="pill" onClick={() => pick(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  )
}
