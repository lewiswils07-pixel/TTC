import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Layout, Monogram } from '../components/Layout'
import { brand } from '../lib/brand'
import { longDate } from '../lib/dates'
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
          <h2>3 months of {brand.plusName}, on us</h2>
          <p>
            As a thank-you for joining early: unlimited connection requests, up to 3 groups and extra filters
            {welcome?.plus_until ? `, until ${longDate(welcome.plus_until.slice(0, 10))}` : ''}. Nothing to pay, and no card needed.
          </p>
        </div>
        <ol className="how-it-works">
          <li>
            <strong>Add a trip</strong> where you’re going and when.
          </li>
          <li>
            <strong>Meet people going too</strong>, matched on what you enjoy.
          </li>
          <li>
            <strong>Plan together</strong> once you both say yes.
          </li>
        </ol>
        <Link className="btn btn-primary btn-block btn-lg" to="/trips/new">
          Add my first trip
        </Link>
        <Link className="btn btn-secondary btn-block" to="/dashboard">
          Go to my profile
        </Link>
      </section>
    </Layout>
  )
}
