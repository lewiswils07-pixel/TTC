import { Link, Navigate } from 'react-router'
import { Layout, Loading, Logo } from '../components/Layout'
import { brand } from '../lib/brand'
import { useSession } from '../lib/session-context'

const STEPS = [
  { title: 'Add your trips', text: 'Where you’re going, and when.' },
  { title: 'See who’s going', text: 'Members heading to the same places at the same time.' },
  { title: 'Connect and plan', text: 'Say hello, chat, and plan days out together.' },
]

/** The first screen for someone signed out (Claude Design, 15 Oct). */
export function Home() {
  const { session, loading } = useSession()
  if (loading) return <Loading />
  if (session) return <Navigate to="/connections" replace />
  return (
    <Layout bare>
      <section className="hello">
        <p className="hello-name">
          <Logo height={112} label />
        </p>
        <h1>{brand.tagline}</h1>
        <p className="lede">A members’ club for solo travellers. Good company for the trip: friendship, never dating.</p>
        <section className="card hello-how" aria-labelledby="how-heading">
          <h2 id="how-heading">How it works</h2>
          <ol>
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="hello-number" aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
        <p className="hint center">Free to join. Once you’re in, you stay signed in.</p>
        <Link className="btn btn-primary btn-block btn-lg" to="/sign-in?join">
          Join
        </Link>
        <Link className="btn btn-secondary btn-block btn-lg" to="/sign-in?signin">
          Sign in
        </Link>
      </section>
    </Layout>
  )
}
