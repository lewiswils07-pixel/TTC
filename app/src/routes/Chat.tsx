import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { refreshTabCounts } from '../lib/tabCounts'
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
import { respondToInvite } from '../lib/groups'
import { shortDates } from '../lib/dates'
import { tripsTogether, type TripTogether } from '../lib/together'
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
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])
  const [senders, setSenders] = useState<Map<string, string>>(new Map())
  const sendersRef = useRef(senders)
  // Opening a chat reads it, so the Chat tab's unread badge is recounted.
  useEffect(refreshTabCounts, [conversationId])
  useEffect(() => {
    sendersRef.current = senders
  }, [senders])
  const seenRef = useRef<Set<number>>(new Set())
  const navigate = useNavigate()
  const list = useRef<HTMLOListElement>(null)
  const stick = useRef(true)

  const add = useCallback((incoming: Message[]) => {
    for (const m of incoming) seenRef.current.add(m.id)
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
    // The same check runs every little while as a safety net (see onNewMessage).
    const catchUp = () => {
      void listMessages(conversationId).then((latest) => {
        const fresh = latest.filter((m) => !seenRef.current.has(m.id))
        if (fresh.length === 0) return
        add(fresh)
        void markRead(conversationId)
        if (fresh.some((m) => m.sender_id !== me && !sendersRef.current.has(m.sender_id))) void conversationSenders(conversationId).then(setSenders)
      }, () => undefined)
      void messageWarnings(conversationId).then(setWarnings, () => undefined)
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
        <h1>Chat not found</h1>
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
          <Link
            className="chat-who"
            to={group ? `/groups/${other.group_id}` : `/connections/people/${other.profile_id}`}
            aria-label={group ? `${other.display_name}: group info` : `${other.display_name}: view profile`}
          >
            <Avatar name={other.display_name} path={other.photo_path} size="sm" />
            <h1>{other.display_name}</h1>
          </Link>
          {group && (
            <Link className="btn btn-secondary btn-small chat-plan-link" to={`/messages/${conversationId}/plan`}>
              Plan board
            </Link>
          )}
          <button
            type="button"
            className="chat-more"
            aria-expanded={menuOpen}
            aria-controls="chat-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span aria-hidden="true">⋯</span>
            <span className="visually-hidden">More options</span>
          </button>
        </div>
        {menuOpen && (
          <div id="chat-menu" className="chat-menu">
            <ul>
              {!group && other.can_message && (
                <li>
                  <Link to={`/plan-together/${other.profile_id}`}>Plan a trip together</Link>
                </li>
              )}
              {!group && (
                <li>
                  <Link to={`/connections/people/${other.profile_id}`}>View {other.display_name}’s profile</Link>
                </li>
              )}
              <li>
                <Link to="/meeting-safely">Meeting up safely</Link>
              </li>
              <li>
                <Link to={`/messages/${conversationId}/share`}>Tell someone you trust</Link>
              </li>
              {group && (
                <li>
                  <Link to={`/groups/${other.group_id}`}>Group info</Link>
                </li>
              )}
            </ul>
            {!group && (
              <SafetyBox profileId={other.profile_id!} name={other.display_name} onBlocked={(message) => navigate('/messages', { state: { message } })} />
            )}
          </div>
        )}

        {!group && other.profile_id && <TripsTogether profileId={other.profile_id} name={other.display_name} canPlan={other.can_message} />}

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

/** Trips being planned with this person, at the top of your chat with them. */
function TripsTogether({ profileId, name, canPlan }: { profileId: string; name: string; canPlan: boolean }) {
  const [trips, setTrips] = useState<TripTogether[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => tripsTogether(profileId).then(setTrips), [profileId])
  useEffect(() => {
    void load()
  }, [load])

  async function answer(t: TripTogether, yes: boolean) {
    setBusy(true)
    setError(null)
    try {
      await respondToInvite(t.group_id, yes)
      await load()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  if (!trips.length) {
    return canPlan ? (
      <p className="together-banner together-start">
        <span>Going somewhere together?</span>
        <Link className="btn btn-secondary btn-small" to={`/plan-together/${profileId}`}>
          Plan a trip together
        </Link>
      </p>
    ) : null
  }
  return (
    <>
      {trips.map((t) => (
        <div key={t.group_id} className="together-banner">
          <p>
            {t.my_status === 'invited'
              ? `${name} would like to plan a trip to ${t.city} together, ${shortDates(t.start_date, t.end_date)}.`
              : t.their_status === 'invited'
                ? `Waiting for ${name} to join your ${t.city} trip, ${shortDates(t.start_date, t.end_date)}.`
                : `Your ${t.city} trip together, ${shortDates(t.start_date, t.end_date)}.`}
          </p>
          <div className="action-row">
            {t.my_status === 'invited' ? (
              <>
                <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => answer(t, false)}>
                  Not now
                </button>
                <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => answer(t, true)}>
                  {busy ? 'Joining…' : 'Join'}
                </button>
              </>
            ) : (
              t.conversation_id && (
                <Link className="btn btn-primary btn-small" to={`/messages/${t.conversation_id}/plan`}>
                  Plan board
                </Link>
              )
            )}
          </div>
        </div>
      ))}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
