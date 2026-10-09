import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Layout } from '../components/Layout'
import { SkeletonRows } from '../components/Skeleton'
import { ChatNav } from '../components/SubNav'
import { peek, remember } from '../lib/cache'
import { messageTime, myConversations, type Conversation } from '../lib/chat'
import { messageOf } from '../lib/errors'
import { ConnectionsSections } from './Connections'

/** One-to-one chats with messages, most recent first, then connections you haven't talked to yet. Group chats are on Groups. */
export function Messages() {
  const [items, setItems] = useState<Conversation[] | null | undefined>(() => peek('conversations'))
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [done, setDone] = useState((useLocation().state as { message?: string } | null)?.message)

  const load = useCallback(() => remember('conversations', myConversations()).then(setItems, (e) => setError(messageOf(e))), [])
  useEffect(() => {
    void load()
    heading.current?.focus()
  }, [load])

  // A one-to-one chat shows here once either of you has written.
  const active = items?.filter((c) => c.kind === 'direct' && c.last_body)

  return (
    <Layout tab="chat">
      <h1 ref={heading} tabIndex={-1}>
        Chat
      </h1>
      <ChatNav current="/messages" />
      {done && (
        <p className="notice notice-success" role="status">
          {done}
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {items === undefined && !error && <SkeletonRows label="Loading your chats…" />}
      {active && active.length === 0 && (
        <div className="card empty">
          <p>When you and another member start talking, your chats appear here.</p>
          <Link className="btn btn-primary btn-block" to="/connections">
            Find people to travel with
          </Link>
        </div>
      )}
      {active && active.length > 0 && (
        <ul className="conversation-list">
          {active.map((c) => (
            <li key={c.id}>
              <Link className="card conversation-row" to={`/messages/${c.id}`}>
                <Avatar name={c.display_name} path={c.photo_path} />
                <span className="conversation-text">
                  <span className="conversation-top">
                    <strong>{c.display_name}</strong>
                    <span className="conversation-time">{messageTime(c.last_at)}</span>
                  </span>
                  <span className={`conversation-last${c.unread ? ' is-unread' : ''}`}>{c.last_body ? `${c.last_mine ? 'You: ' : ''}${c.last_body}` : 'Say hello'}</span>
                </span>
                {c.unread > 0 && (
                  <span className="badge">
                    {c.unread}
                    <span className="visually-hidden"> unread</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ConnectionsSections show="other" conversations={items} onChanged={() => void load()} onMessage={setDone} />
    </Layout>
  )
}
