import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { SaveError } from '../components/Form'
import { signOut } from '../lib/auth'
import { messageOf } from '../lib/errors'
import { myPrivacyChoices, PRIVACY_TOOLS, savePrivacyChoices, type PrivacyChoices } from '../lib/privacy'
import { useSession } from '../lib/session-context'
import { HubRow } from '../components/HubRow'

const LINKS: { to: string; title: string; text: string }[] = [
  { to: '/filters', title: 'Who I’d like to meet', text: 'Age, distance and more' },
  { to: '/settings/privacy', title: 'Privacy choices', text: 'Choose which optional tools we use' },
  { to: '/account', title: 'Account and data', text: 'Password, download your data, delete your account' },
  { to: '/connections?tour=1', title: 'Take the tour again', text: 'A quick look at what you can do' },
]
const LEGAL: { to: string; title: string }[] = [
  { to: '/community-rules', title: 'Community rules' },
  { to: '/terms', title: 'Terms' },
  { to: '/privacy', title: 'Privacy policy' },
]

/** Everything from the gear on Profile. */
export function Settings() {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  return (
    <Layout tab="profile">
      <Link className="back-link" to="/profile">
        ‹ Profile
      </Link>
      <h1 ref={heading} tabIndex={-1}>
        Settings
      </h1>
      <ul className="hub-list">
        {LINKS.map((l) => (
          <li key={l.to}>
            <HubRow to={l.to} title={l.title} text={l.text} />
          </li>
        ))}
      </ul>
      <h2 className="section-title">Legal</h2>
      <ul className="hub-list">
        {LEGAL.map((l) => (
          <li key={l.to}>
            <HubRow to={l.to} title={l.title} />
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-secondary btn-block settings-signout" onClick={() => signOut()}>
        Sign out
      </button>
    </Layout>
  )
}

/** Turn optional tools on or off. Asked first in the "We value your privacy" box. */
export function PrivacyChoicesPage() {
  const userId = useSession().session!.user.id
  const navigate = useNavigate()
  const [choices, setChoices] = useState<PrivacyChoices | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    myPrivacyChoices().then(
      (c) => setChoices(c ?? { measuring: false, marketing: false }),
      () => setChoices({ measuring: false, marketing: false }),
    )
  }, [])
  const loaded = choices !== null
  useEffect(() => {
    if (loaded) heading.current?.focus()
  }, [loaded])

  if (!choices) return <Loading />
  const all = PRIVACY_TOOLS.every((t) => choices[t.key])
  const set = (next: PrivacyChoices) => setChoices(next)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await savePrivacyChoices(userId, choices!)
      navigate('/settings', { replace: true })
    } catch (e) {
      setError(messageOf(e))
      setBusy(false)
    }
  }

  return (
    <Layout tab="profile">
      <Link className="back-link" to="/settings">
        ‹ Settings
      </Link>
      <h1 ref={heading} tabIndex={-1}>
        Privacy choices
      </h1>
      <p className="lede">Choose which optional tools we use when you use the app. You can change your mind here at any time.</p>

      <section className="card privacy-card">
        <label className="switch-row switch-row-end">
          <input type="checkbox" role="switch" checked={all} onChange={(e) => set({ measuring: e.target.checked, marketing: e.target.checked })} />
          <span>
            <strong>Allow all</strong>
            <span className="hint">{all ? 'All tools are on.' : 'Only the tools the app needs are on.'}</span>
          </span>
        </label>
      </section>

      <section className="card privacy-card" aria-labelledby="needed-title">
        <div className="switch-row switch-row-end">
          <span className="tag tag-muted">Always on</span>
          <span>
            <strong id="needed-title">Needed for the app to work</strong>
            <span className="hint">These let you sign in, chat and keep your account safe, so they can’t be turned off.</span>
          </span>
        </div>
        {PRIVACY_TOOLS.map((t) => (
          <label key={t.key} className="switch-row switch-row-end">
            <input type="checkbox" role="switch" checked={choices[t.key]} onChange={(e) => set({ ...choices, [t.key]: e.target.checked })} />
            <span>
              <strong>{t.title}</strong>
              <span className="hint">{t.text}</span>
            </span>
          </label>
        ))}
        <p className="hint">None of these tools track you across other apps and websites.</p>
      </section>

      <SaveError error={error} />
      <div className="action-row">
        <Link className="btn btn-secondary" to="/settings">
          Cancel
        </Link>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save choices'}
        </button>
      </div>
    </Layout>
  )
}
