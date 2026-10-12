import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Layout, Monogram } from '../components/Layout'
import { brand } from '../lib/brand'
import { longDate } from '../lib/dates'
import { count, rules } from '../lib/rules'
import { supabase } from '../lib/supabase'

type Welcome = { plus_until: string | null }

/** Shown once, straight after a member finishes sign-up. */
export function WelcomeScreen() {
  const [welcome, setWelcome] = useState<Welcome | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
    supabase
      .rpc('my_welcome')
      .single<Welcome>()
      .then(({ data }) => setWelcome(data ?? { plus_until: null }))
  }, [])

  return (
    <Layout>
      <section className="welcome">
        <Monogram size={88} />
        <h1 ref={heading} tabIndex={-1}>
          Welcome to the Collective
        </h1>
        <div className="card welcome-gift">
          <h2>
            {brand.plusName} is on us for {count(rules.founding.plusMonths, 'month')}
          </h2>
          <p>
            Connect with as many people as you like{welcome?.plus_until ? `, until ${longDate(welcome.plus_until.slice(0, 10))}` : ''}. No card needed.
          </p>
        </div>
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
