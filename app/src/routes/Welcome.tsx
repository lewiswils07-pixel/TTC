import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { UsersRound } from 'lucide-react'
import { Layout, Logo } from '../components/Layout'
import { AddIcon } from '../components/Icons'
import { brand } from '../lib/brand'
import { longDate } from '../lib/dates'
import { count, rules } from '../lib/rules'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session-context'
import { useMyProfile } from '../lib/useMyProfile'

type Welcome = { plus_until: string | null }

/** Shown once, straight after a member finishes sign-up: their member card and a first step (Claude Design, 15 Oct). */
export function WelcomeScreen() {
  const { session } = useSession()
  const { data } = useMyProfile(session!.user.id)
  const [welcome, setWelcome] = useState<Welcome | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const name = data?.profile.display_name ?? ''
  const [since] = useState(() => new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }))

  useEffect(() => {
    heading.current?.focus()
    supabase
      .rpc('my_welcome')
      .single<Welcome>()
      .then(({ data }) => setWelcome(data ?? { plus_until: null }))
  }, [])

  return (
    <Layout bare>
      <section className="welcome">
        <div className="member-card" aria-hidden="true">
          <span className="member-card-brand">
            <Logo height={50} />
          </span>
          <span className="member-card-foot">
            <span>
              <small>Member</small>
              <strong>{name}</strong>
            </span>
            <span>Since {since}</span>
          </span>
        </div>
        <h1 ref={heading} tabIndex={-1}>
          You’re in{name ? `, ${name}` : ''}
        </h1>
        <p className="lede">Welcome to the Collective. Add your first trip to see who’s going your way.</p>
        <div className="card welcome-rules">
          <span className="welcome-rules-icon" aria-hidden="true">
            <UsersRound size={22} strokeWidth={1.8} />
          </span>
          <div>
            <strong>Here for friendship and travel</strong>
            <p>Be kind, meet somewhere public first, and keep it friendly.</p>
            <Link to="/community-rules">Read the community rules</Link>
          </div>
        </div>
        {/* Members in the pricing test start on the free plan, so only show the gift when they have it. */}
        {welcome?.plus_until && (
          <p className="welcome-gift">
            {brand.plusName} is on us for {count(rules.founding.plusMonths, 'month')}, until {longDate(welcome.plus_until.slice(0, 10))}. No card needed.
          </p>
        )}
        <div className="welcome-actions">
          <Link className="btn btn-primary btn-block btn-lg" to="/trips/new">
            <AddIcon />
            Add your first trip
          </Link>
          <Link className="btn btn-secondary btn-block btn-lg" to="/connections">
            See who’s going
          </Link>
        </div>
      </section>
    </Layout>
  )
}
