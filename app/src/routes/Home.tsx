import { Link, Navigate } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { TravelArt } from '../components/TravelArt'
import { brand } from '../lib/brand'
import { useSession } from '../lib/session-context'

const STEPS = [
  { title: 'Meet people one at a time', text: 'Matched on what you enjoy, and where you’re going if you add a trip.' },
  { title: 'Say hello', text: 'Chat once your request is accepted.' },
  { title: 'Plan together', text: 'Pick dates, share ideas and travel at your own pace.' },
]

const POINTS = [
  { title: 'Matched on what matters', text: 'Suggestions based on where you’re going, when, and what you enjoy.' },
  { title: 'Nothing shared until you’re connected', text: 'Connect first, then chat. Your details stay private.' },
  { title: 'Safety built in', text: 'Block or report anyone, any time. A real person reviews every report.' },
]

export function Home() {
  const { session, loading } = useSession()
  if (loading) return <Loading />
  if (session) return <Navigate to="/connections" replace />
  return (
    <Layout>
      <section className="hero">
        <TravelArt />
        <h1>{brand.tagline}</h1>
        <p className="lede">Meet like-minded people going to the same places as you, and travel together at your own pace.</p>
        <p className="hero-for">For solo travellers, and anyone whose friends can’t always come along.</p>
        <Link className="btn btn-primary btn-block btn-lg" to="/sign-in">
          Join or sign in
        </Link>
        <p className="hint center">Free to join. Once you’re in, you stay signed in.</p>
      </section>
      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="section-title gold-rule">
          How it works
        </h2>
        <ol className="steps-strip">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="step-number" aria-hidden="true">
                {i + 1}
              </span>
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </section>
      <ul className="points">
        {POINTS.map((p) => (
          <li key={p.title} className="card point">
            <h2>{p.title}</h2>
            <p>{p.text}</p>
          </li>
        ))}
      </ul>
    </Layout>
  )
}
