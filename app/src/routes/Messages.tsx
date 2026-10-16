import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { MessageCircle } from 'lucide-react'
import { Layout } from '../components/Layout'
import { SkeletonRows } from '../components/Skeleton'
import { ChatNav } from '../components/SubNav'
import { peek, remember } from '../lib/cache'
import { listTime, myConversations, type Conversation } from '../lib/chat'
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
        <EmptyState icon={<MessageCircle size={18} strokeWidth={2} />} title="No chats yet" text="When you connect with someone and say hello, your conversation will appear here.">
          <Link className="btn btn-primary btn-block" to="/connections">
            See who’s going
          </Link>
        </EmptyState>
      )}
      {active && active.length > 0 && (
        <ul className="chat-list">
          {active.map((c) => (
            <li key={c.id}>
              <Link className={`chat-row${c.unread ? ' is-unread' : ''}`} to={`/messages/${c.id}`}>
                <Avatar name={c.display_name} path={c.photo_path} square />
                <span className="chat-row-text">
                  <span className="chat-row-top">
                    <strong>{c.display_name}</strong>
                    <span className="chat-row-time">{listTime(c.last_at)}</span>
                  </span>
                  <span className="chat-row-last">
                    <span>{c.last_body ? `${c.last_mine ? 'You: ' : ''}${c.last_body}` : 'Say hello'}</span>
                    {c.unread > 0 && (
                      <span className="unread-dot">
                        <span className="visually-hidden">{c.unread} unread</span>
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ConnectionsSections show="other" conversations={items} onChanged={() => void load()} onMessage={setDone} />
    </Layout>
  )
}
