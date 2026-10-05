import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router'
import { Layout } from '../components/Layout'

const TIPS: { title: string; text: string }[] = [
  { title: 'Get to know each other here first', text: 'Chat in the app, and have a video call before you meet. Someone who won’t talk on camera is a reason to be careful.' },
  { title: 'Meet somewhere busy, in daylight', text: 'A café, a museum or a hotel lobby is ideal. Never meet first at a private home or where you’re staying.' },
  { title: 'Tell someone you trust', text: 'Share who you’re meeting, where and when, and check in with them afterwards.' },
  { title: 'Keep your own plans', text: 'Arrange your own transport and keep your own booking until you know each other well. You don’t need to share where you’re staying.' },
  { title: 'Never send money', text: 'Don’t send or lend money, buy gift cards, or share bank details with someone you haven’t met, whatever the story. Report anyone who asks.' },
  { title: 'Keep your essentials with you', text: 'Passport, cards and phone stay with you, and keep your phone charged.' },
  { title: 'Trust your instincts', text: 'You can leave at any time, and you don’t owe anyone an explanation. Block or report from their profile or your chat.' },
  { title: 'Before you travel together', text: 'Agree your budget, pace and how you’ll split costs before you book anything, and start with something short.' },
]

/** The meeting-up guide, linked from every chat. */
export function MeetingSafely() {
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
        <Link className="back-link" to="/profile">
          ‹ My profile
        </Link>
      )}
      <h1 ref={heading} tabIndex={-1}>
        Meeting up safely
      </h1>
      <p className="lede">Most members are exactly who they say they are. These habits keep it that way for everyone.</p>
      <ol className="guide-list">
        {TIPS.map((t) => (
          <li key={t.title} className="card">
            <h2>{t.title}</h2>
            <p>{t.text}</p>
          </li>
        ))}
      </ol>
      <p className="notice">
        <strong>In an emergency</strong> call 112 anywhere in Europe, or 999 in the UK.
      </p>
    </Layout>
  )
}
