import { Link, Navigate } from 'react-router'
import { Layout, Loading, Monogram } from '../components/Layout'
import { TravelArt } from '../components/TravelArt'
import { brand } from '../lib/brand'
import { useSession } from '../lib/session-context'

const STEPS = [
  { title: 'Add a trip', text: 'Where you’re going and when.' },
  { title: 'Meet people going too', text: 'Matched on what you enjoy.' },
  { title: 'Plan together', text: 'Chat and plan once you both say yes.' },
]

const POINTS = [
  { title: 'Matched on what matters', text: 'Suggestions based on where you’re going, when, and what you enjoy.' },
  { title: 'Nothing shared until you both say yes', text: 'Connect first, then chat. Your details stay private.' },
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
        <Monogram size={56} />
        <h1>{brand.tagline}</h1>
        <p className="lede">Meet like-minded people going to the same places as you, and travel together at your own pace.</p>
        <p className="hero-for">For solo travellers, and anyone whose friends can’t always come along.</p>
        <Link className="btn btn-primary btn-block btn-lg" to="/sign-in">
          Join or sign in
        </Link>
        <p className="hint center">Free to join. No password needed: we email you a code.</p>
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
