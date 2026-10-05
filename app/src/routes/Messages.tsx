import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Layout, Loading } from '../components/Layout'
import { messageTime, myConversations, type Conversation } from '../lib/chat'
import { messageOf } from '../lib/errors'

/** Everyone the member can chat with, most recent first. */
export function Messages() {
  const [items, setItems] = useState<Conversation[] | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    myConversations().then(setItems, (e) => setError(messageOf(e)))
    heading.current?.focus()
  }, [])

  if (items === undefined && !error) return <Loading />

  return (
    <Layout>
      <Link className="back-link" to="/dashboard">
        ‹ My profile
      </Link>
      <h1 ref={heading} tabIndex={-1}>
        Messages
      </h1>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {items && items.length === 0 && (
        <div className="card empty">
          <p>When someone accepts your request, or you accept theirs, you can message each other here.</p>
          <Link className="btn btn-primary btn-block" to="/people">
            Find people to travel with
          </Link>
        </div>
      )}
      {items && items.length > 0 && (
        <ul className="conversation-list">
          {items.map((c) => (
            <li key={c.id}>
              <Link className="card conversation-row" to={`/messages/${c.id}`}>
                <Avatar name={c.display_name} path={c.photo_path} />
                <span className="conversation-text">
                  <span className="conversation-top">
                    <strong>{c.display_name}</strong>
                    <span className="conversation-time">{messageTime(c.last_at)}</span>
                  </span>
                  <span className={`conversation-last${c.unread ? ' is-unread' : ''}`}>
                    {c.last_body ? `${c.last_mine ? 'You: ' : ''}${c.last_body}` : 'Say hello'}
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
