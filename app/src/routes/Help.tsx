import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmergencyNumbers } from '../components/EmergencyNumbers'
import { Layout } from '../components/Layout'
import { brand } from '../lib/brand'
import { count, rules } from '../lib/rules'

const QUESTIONS: { q: string; a: string; link?: { to: string; label: string } }[] = [
  {
    q: 'How do I meet people?',
    a: 'Add a trip and we’ll show you members going to the same place at the same time. Or browse For you on Connections and tap Connect.',
    link: { to: '/trips/new', label: 'Add a trip' },
  },
  {
    q: 'How do requests work?',
    a: `Free members can send ${count(rules.requests.perWeekFree, 'request')} a week, and get more each Monday. Nothing beyond your first name, age and home town is shared until someone accepts.`,
  },
  {
    q: 'How do I plan a trip with someone?',
    a: 'Once you’re connected, open your chat with them and tap Plan a trip together. You can choose one of your trips or somewhere new.',
  },
  {
    q: `What does ${brand.plusName} cost?`,
    a: `Founding members get it free for ${count(rules.founding.plusMonths, 'month')}, with no card needed. After that you move to the free plan on your own, and you can stop ${brand.plusName} any time in one tap.`,
    link: { to: '/profile?tab=plus', label: `About ${brand.plusName}` },
  },
  {
    q: 'I forgot my password',
    a: 'On the sign-in screen, tap Forgotten your password? and we’ll email you a code to choose a new one.',
  },
  {
    q: 'How do I block or report someone?',
    a: 'Tap Block or report at the foot of their card, or in the ⋯ menu of your chat. They aren’t told who reported them.',
  },
  {
    q: 'How do I download or delete my data?',
    a: 'Go to Settings, then Account and data.',
    link: { to: '/account', label: 'Account and data' },
  },
]

/** Help and contact: common questions, and an email address that reaches a person. */
export function Help() {
  const navigate = useNavigate()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1

  return (
    <Layout>
      {canGoBack ? (
        <button type="button" className="back-link btn-plain" onClick={() => navigate(-1)}>
          ‹ Back
        </button>
      ) : (
        <Link className="back-link" to="/settings">
          ‹ Settings
        </Link>
      )}
      <h1 ref={heading} tabIndex={-1}>
        Help and contact
      </h1>
      {brand.supportEmail && (
        <section className="card help-contact" aria-labelledby="contact-title">
          <h2 id="contact-title">Talk to us</h2>
          <p>Email us about anything, from a question to something that worried you. A real person reads every message.</p>
          <a className="btn btn-primary" href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent(`${brand.shortName} help`)}`}>
            Email {brand.supportEmail}
          </a>
        </section>
      )}
      <h2 className="section-title">Common questions</h2>
      <ul className="help-list">
        {QUESTIONS.map((x) => (
          <li key={x.q} className="card">
            <details>
              <summary>{x.q}</summary>
              <p>{x.a}</p>
              {x.link && <Link to={x.link.to}>{x.link.label}</Link>}
            </details>
          </li>
        ))}
      </ul>
      <section className="notice" aria-labelledby="urgent-title">
        <strong id="urgent-title">If you need help now</strong>
        <EmergencyNumbers />
        <Link to="/meeting-safely">Meeting up safely</Link>
      </section>
    </Layout>
  )
}
