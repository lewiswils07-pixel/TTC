import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { PageTop } from '../components/PageBack'
import { Avatar } from '../components/Avatar'
import { Layout } from '../components/Layout'
import { EmergencyNumbers } from '../components/EmergencyNumbers'
import { myConversations, type Conversation } from '../lib/chat'
import { NextIcon } from '../components/Icons'

const TIPS: { title: string; text: string }[] = [
  { title: 'Get to know each other here first', text: 'Chat in the app, and have a video call before you meet. Someone who won’t talk on camera is a reason to be careful.' },
  { title: 'Meet somewhere busy, in daylight', text: 'A café, a museum or a hotel lobby is ideal. Never meet first at a private home or where you’re staying.' },
  {
    title: 'Tell someone you trust',
    text: 'Share who you’re meeting, where and when. In your chat, tap ⋯ then “Share where you’re meeting” to send them a private link, then tap “I’m back safe” when you’re home.',
  },
  { title: 'Keep your own plans', text: 'Arrange your own transport and keep your own booking until you know each other well. You don’t need to share where you’re staying.' },
  { title: 'Never send money', text: 'Don’t send or lend money, buy gift cards, or share bank details with someone you haven’t met, whatever the story. Report anyone who asks.' },
  { title: 'Keep your essentials with you', text: 'Passport, cards and phone stay with you, and keep your phone charged.' },
  { title: 'Trust your instincts', text: 'You can leave at any time, and you don’t owe anyone an explanation. Block or report them from their card or your chat.' },
  { title: 'Before you travel together', text: 'Agree your budget, pace and how you’ll split costs before you book anything, and start with something short.' },
]

/** "Tell someone you trust", started from here: pick who you're meeting (testers, 13 Oct: the Profile link didn't start anything). */
function TellSomeone() {
  const [people, setPeople] = useState<Conversation[] | null>(null)
  useEffect(() => {
    myConversations().then(
      (list) => setPeople((list ?? []).filter((c) => c.kind === 'direct' && c.can_message)),
      () => setPeople([]),
    )
  }, [])
  return (
    <section className="card tell-someone" id="tell-someone" aria-labelledby="tell-title">
      <h2 id="tell-title">Tell someone you trust</h2>
      <p className="hint">Before every meet-up, share where and when with someone you trust. Pick who you’re meeting to make a private link, and tap “I’m back safe” when you’re home.</p>
      {people === null ? null : people.length === 0 ? (
        <p className="hint">Once you’re connected with someone, you can start it here or from your chat with them.</p>
      ) : (
        <ul className="tell-list">
          {people.slice(0, 8).map((c) => (
            <li key={c.id}>
              <Link className="tell-row" to={`/messages/${c.id}/share`}>
                <Avatar name={c.display_name} path={c.photo_path} size="sm" square />
                <span>Meeting {c.display_name}</span>
                <span className="trip-chevron" aria-hidden="true">
                  <NextIcon />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** The meeting-up guide, linked from every chat. */
export function MeetingSafely() {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])

  return (
    <Layout>
      <PageTop tag="Safety guide" fallback="/profile" />
      <h1 ref={heading} tabIndex={-1}>
        Meeting up safely
      </h1>
      <p className="lede">Most members are exactly who they say they are. These habits keep it that way for everyone.</p>
      <ol className="numbered-list">
        {TIPS.map((t) => (
          <li key={t.title} className="card">
            <h2>{t.title}</h2>
            <p>{t.text}</p>
          </li>
        ))}
      </ol>
      <TellSomeone />
      <div className="notice emergency-box">
        <strong>If you need help now</strong>
        <EmergencyNumbers />
      </div>
    </Layout>
  )
}
