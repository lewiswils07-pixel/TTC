import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Layout, Loading } from '../components/Layout'
import { SafetyBox } from '../components/SafetyBox'
import {
  conversationSenders,
  listMessages,
  markRead,
  MAX_MESSAGE,
  messageTime,
  messageWarnings,
  myConversations,
  onNewMessage,
  PAGE_SIZE,
  sendMessage,
  type Conversation,
  type Message,
} from '../lib/chat'
import { messageOf } from '../lib/errors'
import { guideSeen, markGuideSeen } from '../lib/meet'
import { useSession } from '../lib/session-context'

/** One conversation: messages oldest to newest, new ones arriving live, and a box to reply. */
export function Chat() {
  const conversationId = Number(useParams().id)
  const { session } = useSession()
  const me = session!.user.id
  const [other, setOther] = useState<Conversation | null | undefined>(undefined)
  const [messages, setMessages] = useState<Message[]>([])
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<Set<number>>(new Set())
  const [reporting, setReporting] = useState<number | null>(null)
  const [senders, setSenders] = useState<Map<string, string>>(new Map())
  const sendersRef = useRef(senders)
  useEffect(() => {
    sendersRef.current = senders
  }, [senders])
  const navigate = useNavigate()
  const list = useRef<HTMLOListElement>(null)
  const stick = useRef(true)

  const add = useCallback((incoming: Message[]) => {
    setMessages((current) => {
      const seen = new Set(current.map((m) => m.id))
      return [...current, ...incoming.filter((m) => !seen.has(m.id))].sort((a, b) => a.id - b.id)
    })
  }, [])

  useEffect(() => {
    Promise.all([myConversations(), listMessages(conversationId), messageWarnings(conversationId)]).then(
      ([all, first, warn]) => {
        const found = all?.find((c) => c.id === conversationId) ?? null
        setOther(found)
        if (found?.kind === 'group') void conversationSenders(conversationId).then(setSenders)
        setWarnings(warn)
        add(first)
        setMore(first.length === PAGE_SIZE)
        void markRead(conversationId)
      },
      (e) => setError(messageOf(e)),
    )
    // Messages sent while the live connection was opening are fetched once it's ready.
    const catchUp = () => {
      void listMessages(conversationId).then(add, () => undefined)
      void messageWarnings(conversationId).then(setWarnings)
    }
    return onNewMessage(conversationId, catchUp, (m) => {
      stick.current = true
      add([m])
      void markRead(conversationId)
      // The server decides which messages need a warning; ask again for theirs.
      if (m.sender_id !== me) {
        void messageWarnings(conversationId).then(setWarnings)
        if (!sendersRef.current.has(m.sender_id)) void conversationSenders(conversationId).then(setSenders)
      }
    })
  }, [conversationId, add, me])

  // Keep the newest message in view as messages arrive.
  useLayoutEffect(() => {
    if (stick.current) list.current?.lastElementChild?.scrollIntoView({ block: 'end' })
  }, [messages])

  async function loadEarlier() {
    stick.current = false
    const earlier = await listMessages(conversationId, messages[0]?.id)
    setMore(earlier.length === PAGE_SIZE)
    add(earlier)
  }

  if (error && other === undefined) {
    return (
      <Layout>
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      </Layout>
    )
  }
  if (other === undefined) return <Loading />
  if (other === null) {
    return (
      <Layout>
        <h1>Conversation not found</h1>
        <p className="lede">It may have ended.</p>
        <Link className="btn btn-secondary" to="/messages">
          Back to messages
        </Link>
      </Layout>
    )
  }

  const group = other.kind === 'group'
  const nameOf = (id: string) => (group ? (senders.get(id) ?? 'A former member') : other.display_name)

  return (
    <Layout>
      <div className="chat">
        <div className="chat-head">
          <Link className="back-link" to="/messages" aria-label="Back to messages">
            ‹
          </Link>
          <Avatar name={other.display_name} path={other.photo_path} size="sm" />
          <h1>{other.display_name}</h1>
        </div>
        <div className="chat-tools">
          <Link className="safety-link chat-plan-link" to={`/messages/${conversationId}/plan`}>
            Plan board
          </Link>
          <Link className="safety-link" to="/meeting-safely">
            Meeting up safely
          </Link>
          {group ? (
            <Link className="safety-link" to={`/groups/${other.group_id}`}>
              Group details and members
            </Link>
          ) : (
            <SafetyBox profileId={other.profile_id!} name={other.display_name} onBlocked={(message) => navigate('/messages', { state: { message } })} />
          )}
        </div>

        <section className="chat-body" aria-label={`Messages with ${other.display_name}`}>
          {more && (
            <button type="button" className="btn-link chat-earlier" onClick={loadEarlier}>
              Show earlier messages
            </button>
          )}
          <GuideCard />
          {messages.length === 0 && (
            <p className="hint chat-empty">
              {group ? 'This is your group chat. Say hello!' : 'You’re connected. Say hello!'}
            </p>
          )}
          <ol className="message-list" ref={list} aria-live="polite" aria-relevant="additions">
            {messages.map((m) => {
              const mine = m.sender_id === me
              return (
                <Fragment key={m.id}>
                  <li className={`message ${mine ? 'message-mine' : 'message-theirs'}`}>
                    {group && !mine ? (
                      <span className="message-sender">{nameOf(m.sender_id)}</span>
                    ) : (
                      <span className="visually-hidden">{mine ? 'You' : other.display_name}: </span>
                    )}
                    <p className="message-body">{m.body}</p>
                    <time className="message-time" dateTime={m.created_at}>
                      {messageTime(m.created_at)}
                    </time>
                  </li>
                  {!mine && warnings.has(m.id) && (
                    <li className="scam-warning">
                      <p>
                        <strong>Never send money to someone you haven’t met.</strong> Report if this feels wrong.
                      </p>
                      {reporting === m.id ? (
                        <SafetyBox
                          profileId={m.sender_id}
                          name={nameOf(m.sender_id)}
                          messageId={m.id}
                          onCancel={() => setReporting(null)}
                          onBlocked={(message) => navigate('/messages', { state: { message } })}
                        />
                      ) : (
                        <button type="button" className="btn-link" onClick={() => setReporting(m.id)}>
                          Report this message
                        </button>
                      )}
                    </li>
                  )}
                </Fragment>
              )
            })}
          </ol>
        </section>

        {other.can_message ? (
          <Composer conversationId={conversationId} name={group ? 'the group' : other.display_name} onSent={add} />
        ) : (
          <p className="notice">This conversation has ended. You can still read it.</p>
        )}
      </div>
    </Layout>
  )
}

function Composer({ conversationId, name, onSent }: { conversationId: number; name: string; onSent: (m: Message[]) => void }) {
  const { session } = useSession()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const box = useRef<HTMLTextAreaElement>(null)

  async function send() {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError(null)
    try {
      const id = await sendMessage(conversationId, body)
      // Show it straight away; the live update for the same id is ignored.
      onSent([{ id, conversation_id: conversationId, sender_id: session!.user.id, body, created_at: new Date().toISOString() }])
      setText('')
      box.current?.focus()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="composer-row">
        <label className="visually-hidden" htmlFor="message">
          Message {name}
        </label>
        <textarea
          ref={box}
          id="message"
          className="textarea composer-input"
          rows={1}
          maxLength={MAX_MESSAGE}
          placeholder={`Message ${name}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends on a keyboard; Shift+Enter adds a new line.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <button type="submit" className="btn btn-primary composer-send" disabled={busy || !text.trim()}>
          Send
        </button>
      </div>
    </form>
  )
}

/** The short meeting-up guide, shown once (the first time a member opens a chat). */
function GuideCard() {
  const [show, setShow] = useState(() => !guideSeen())
  if (!show) return null
  return (
    <aside className="card guide-card" aria-labelledby="guide-title">
      <h2 id="guide-title">Before you meet</h2>
      <ul>
        <li>Have a video call first.</li>
        <li>Meet somewhere busy, in daylight.</li>
        <li>Tell someone you trust where you’ll be.</li>
        <li>Never send money to someone you haven’t met.</li>
      </ul>
      <div className="action-row">
        <Link className="btn btn-secondary btn-small" to="/meeting-safely">
          Read the full guide
        </Link>
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={() => {
            markGuideSeen()
            setShow(false)
          }}
        >
          Got it
        </button>
      </div>
    </aside>
  )
}
