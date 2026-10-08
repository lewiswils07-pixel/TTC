// Terms, privacy notice and community rules, in plain English. These are
// first drafts for the beta (Lewis's sign-up review, item 1), to be checked
// before public launch.
import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Layout } from '../components/Layout'
import { brand } from '../lib/brand'
import { count, rules } from '../lib/rules'

const UPDATED = '5 October 2026'

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const navigate = useNavigate()
  useEffect(() => heading.current?.focus(), [])
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1
  return (
    <Layout>
      {canGoBack ? (
        <button type="button" className="back-link btn-plain" onClick={() => navigate(-1)}>
          ‹ Back
        </button>
      ) : (
        <Link className="back-link" to="/">
          ‹ Home
        </Link>
      )}
      <article className="legal">
        <p className="eyebrow gold-rule">{brand.name}</p>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <p className="hint">Last updated {UPDATED}. This is an early version for our first members.</p>
        {children}
        <p className="legal-links">
          <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy notice</Link> · <Link to="/community-rules">Community rules</Link>
        </p>
      </article>
    </Layout>
  )
}

export function Terms() {
  return (
    <LegalPage title="Terms">
      <p>
        {brand.name} helps adults find people to travel with. By joining, you agree to these terms, our{' '}
        <Link to="/privacy">privacy notice</Link> and our <Link to="/community-rules">community rules</Link>.
      </p>
      <h2>Joining</h2>
      <ul>
        <li>You must be {rules.age.min} or over, and the details you give about yourself must be true.</li>
        <li>One person per profile. If you travel with someone, add a note to your profile rather than sharing an account.</li>
        <li>Keep your sign-in email secure: anyone who can read it can sign in as you.</li>
      </ul>
      <h2>Meeting people</h2>
      <ul>
        <li>We suggest people; we don’t check everyone’s background, and we aren’t a travel agent. You decide who to meet and travel with.</li>
        <li>Meet in public first, tell someone where you’re going, and never send money to someone you’ve met here.</li>
        <li>Any trip you arrange is between you and the people you travel with.</li>
      </ul>
      <h2>{brand.plusName}</h2>
      <p>
        Founding members get {count(rules.founding.plusMonths, 'month')} of {brand.plusName} free. It ends on its own: you won’t be charged, and we’ll ask before
        offering any paid plan.
      </p>
      <h2>When we can step in</h2>
      <p>
        We may warn, pause or remove a member who breaks the community rules, and remove anything they’ve posted. You can leave at any
        time.
      </p>
      <h2>Our responsibility</h2>
      <p>
        We work hard to keep the app safe and running, but we can’t promise it will always be available or that every member will behave
        well. Nothing in these terms limits your rights under UK consumer law.
      </p>
    </LegalPage>
  )
}

export function Privacy() {
  return (
    <LegalPage title="Privacy notice">
      <p>This explains what we collect, why, who can see it, and your rights under UK data protection law.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your email address, to send sign-in codes.</li>
        <li>
          Your profile: first name, date of birth, gender, home town, photo, bio, interests, travel style and the optional questions about
          how you travel.
        </li>
        <li>Your trips, places you’d like to visit, connections, messages, groups and plan ideas.</li>
        <li>Reports you make or that are made about you, and when you last opened the app.</li>
      </ul>
      <h2>Why</h2>
      <p>
        To run the service you’ve signed up for: suggesting people, letting you connect and chat, and keeping members safe. We check
        messages automatically for common scams (such as requests for money) so we can warn the reader.
      </p>
      <h2>Who can see what</h2>
      <ul>
        <li>Other members see your first name, age (never your date of birth), home town, photo, interests and shared trip dates.</li>
        <li>Messages are seen only by the people in that conversation, and by our team if a message is reported or flagged.</li>
        <li>We never sell your details or show you adverts.</li>
      </ul>
      <h2>Where it’s kept</h2>
      <p>
        With the companies that run the app for us: Supabase (database and sign-in), Netlify (the website) and Google (sending sign-in
        emails). They only use your details to provide that service.
      </p>
      <h2>How long</h2>
      <p>For as long as you’re a member. If you leave, we delete your profile, except what we must keep about safety reports.</p>
      <h2>Your rights</h2>
      <p>
        You can ask for a copy of your details, have them corrected or deleted, or object to how we use them. Reply to any sign-in email to
        contact us. If you’re unhappy with our answer, you can complain to the Information Commissioner’s Office (ico.org.uk).
      </p>
    </LegalPage>
  )
}

export function CommunityRules() {
  return (
    <LegalPage title="Community rules">
      <p>
        {brand.name} works because members trust each other. Breaking these rules can lead to a warning, a pause or removal. Use{' '}
        <strong>Block or report</strong> on any profile or message, and a real person will review it.
      </p>
      <ol className="rules">
        <li>
          <strong>Be yourself.</strong> Use your real first name, age and a recent photo of you.
        </li>
        <li>
          <strong>Be kind and respectful.</strong> No harassment, hate, threats or unwanted romantic or sexual messages.
        </li>
        <li>
          <strong>Never ask for money.</strong> No loans, gifts, bank details, gift cards or crypto, for any reason.
        </li>
        <li>
          <strong>No selling.</strong> Don’t promote businesses, tours or other apps.
        </li>
        <li>
          <strong>Respect a no.</strong> If someone declines or stops replying, leave it there.
        </li>
        <li>
          <strong>Keep it private.</strong> Don’t share other members’ details, photos or messages outside the app.
        </li>
        <li>
          <strong>Meet safely.</strong> Meet in public first and tell someone your plans. See <Link to="/meeting-safely">Meeting up safely</Link>.
        </li>
      </ol>
    </LegalPage>
  )
}
