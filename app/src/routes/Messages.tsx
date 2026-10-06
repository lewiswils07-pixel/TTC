import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Layout, Loading } from '../components/Layout'
import { SubNav } from '../components/SubNav'
import { peek, remember } from '../lib/cache'
import { CHAT_NAV } from '../lib/nav'
import { messageTime, myConversations, type Conversation } from '../lib/chat'
import { messageOf } from '../lib/errors'

/** Everyone the member can chat with, most recent first. */
export function Messages() {
  const [items, setItems] = useState<Conversation[] | null | undefined>(() => peek('conversations'))
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const done = (useLocation().state as { message?: string } | null)?.message

  useEffect(() => {
    remember('conversations', myConversations()).then(setItems, (e) => setError(messageOf(e)))
    heading.current?.focus()
  }, [])

  if (items === undefined && !error) return <Loading />

  return (
    <Layout tab="chat">
      <h1 ref={heading} tabIndex={-1}>
        Chat
      </h1>
      <SubNav label="Chat" items={CHAT_NAV} current="/messages" />
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
      {items && items.length === 0 && (
        <div className="card empty">
          <p>When someone accepts your request, or you accept theirs, you can message each other here.</p>
          <Link className="btn btn-primary btn-block" to="/connections">
            Find people to travel with
          </Link>
        </div>
      )}
      {items && items.length > 0 && (
        <ul className="conversation-list">
          {items.map((c) => (
            <li key={c.id}>
              <Link className="card conversation-row" to={`/messages/${c.id}`}>
                {c.kind === 'group' ? (
                  <span className="avatar avatar-md avatar-empty avatar-group" aria-hidden="true">
                    {c.display_name.slice(0, 1).toUpperCase()}
                  </span>
                ) : (
                  <Avatar name={c.display_name} path={c.photo_path} />
                )}
                <span className="conversation-text">
                  <span className="conversation-top">
                    <strong>{c.display_name}</strong>
                    <span className="conversation-time">{messageTime(c.last_at)}</span>
                  </span>
                  <span className={`conversation-last${c.unread ? ' is-unread' : ''}`}>
                    {c.last_body ? `${c.last_mine ? 'You: ' : c.kind === 'group' && c.last_sender ? `${c.last_sender}: ` : ''}${c.last_body}` : 'Say hello'}
                  </span>
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
    </Layout>
  )
}
