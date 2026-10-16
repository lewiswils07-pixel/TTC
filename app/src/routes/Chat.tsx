import { AddIcon, BackIcon, CloseIcon, MoreIcon } from '../components/Icons'
import { ArrowUp, Ban, BriefcaseBusiness, ClipboardList, Flag, MapPin, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { refreshTabCounts } from '../lib/tabCounts'
import { Layout, Loading } from '../components/Layout'
import { SafetyBox, SafetySheet } from '../components/SafetyBox'
import {
  conversationSenders,
  dayLabel,
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
import { groupDates, isTripGroup, myGroups, respondToInvite, type Group, type GroupDates } from '../lib/groups'
import { DateOverlap } from '../components/DateOverlap'
import { CityPhoto } from '../components/CityPhoto'
import { shortDates } from '../lib/dates'
import { tripsTogether, type TripTogether } from '../lib/together'
import { guideSeen, markGuideSeen } from '../lib/meet'
import { useSession } from '../lib/session-context'
import { ageLabel } from '../lib/options'

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
  const [groupInfo, setGroupInfo] = useState<Group | null>(null)
  const [datesOpen, setDatesOpen] = useState(false)
  const [together, setTogether] = useState('')

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
        if (found?.kind === 'group') {
          void conversationSenders(conversationId).then(setSenders)
          void myGroups().then(
            (g) => setGroupInfo(g?.find((x) => x.id === found.group_id) ?? null),
            () => undefined,
          )
        }
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
      void listMessages(conversationId).then(
        (latest) => {
          const fresh = latest.filter((m) => !seenRef.current.has(m.id))
          if (fresh.length === 0) return
          add(fresh)
          void markRead(conversationId)
          if (fresh.some((m) => m.sender_id !== me && !sendersRef.current.has(m.sender_id))) void conversationSenders(conversationId).then(setSenders)
        },
        () => undefined,
      )
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

  const sub = group
    ? groupInfo && isTripGroup(groupInfo)
      ? `${groupInfo.city} · ${shortDates(groupInfo.start_date, groupInfo.end_date)}`
      : groupInfo
        ? `${groupInfo.members} members`
        : 'Group chat'
    : together
  const blocked = (message: string) => navigate('/messages', { state: { message } })

  return (
    <Layout>
      <div className="chat">
        <div className="chat-head">
          <Link className="back-link" to={group ? '/groups' : '/messages'} aria-label={group ? 'Back to groups' : 'Back to messages'}>
            <BackIcon />
          </Link>
          <Link
            className="chat-who"
            to={group ? `/groups/${other.group_id}` : `/connections/people/${other.profile_id}`}
            aria-label={group ? `${other.display_name}: group info` : `${other.display_name}: view profile`}
          >
            {group ? (
              <span className="avatar avatar-sm avatar-square avatar-group" aria-hidden="true">
                <UsersRound size={20} strokeWidth={1.8} />
              </span>
            ) : (
              <Avatar name={other.display_name} path={other.photo_path} size="sm" square />
            )}
            <span className="chat-who-text">
              <h1>
                {other.display_name}
                {!group && other.birth_year ? `, ${ageLabel(other.birth_year)}` : ''}
              </h1>
              {sub && <span className="chat-who-sub">{sub}</span>}
            </span>
          </Link>
          <button type="button" className="chat-more" aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
            <MoreIcon />
            <span className="visually-hidden">More options</span>
          </button>
        </div>
        {menuOpen && <ChatSheet conversationId={conversationId} other={other} group={groupInfo} onClose={() => setMenuOpen(false)} onBlocked={blocked} />}

        {group && <GroupOptions conversationId={conversationId} groupId={other.group_id!} group={groupInfo} datesOpen={datesOpen} onDates={() => setDatesOpen(!datesOpen)} me={me} />}

        <section className="chat-body" aria-label={`Messages with ${other.display_name}`}>
          <GuideCard />
          {!group && other.profile_id && <TripsTogether profileId={other.profile_id} name={other.display_name} canPlan={other.can_message} onTrip={setTogether} />}
          {more && (
            <button type="button" className="btn-link chat-earlier" onClick={loadEarlier}>
              Show earlier messages
            </button>
          )}
          {messages.length === 0 && <p className="hint chat-empty">{group ? 'This is your group chat. Say hello!' : 'You’re connected. Say hello!'}</p>}
          <ol className="message-list" ref={list} aria-live="polite" aria-relevant="additions">
            {messages.map((m, i) => {
              const mine = m.sender_id === me
              const prev = messages[i - 1]
              const next = messages[i + 1]
              const day = dayLabel(m.created_at)
              const newDay = !prev || dayLabel(prev.created_at) !== day
              // The time shows under the last message of a run from the same person, like the design.
              const lastOfRun = !next || next.sender_id !== m.sender_id || dayLabel(next.created_at) !== day || new Date(next.created_at).getTime() - new Date(m.created_at).getTime() > 10 * 60_000
              const firstOfRun = !prev || prev.sender_id !== m.sender_id || newDay
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <li className="message-day" aria-hidden="true">
                      <span>{day}</span>
                    </li>
                  )}
                  <li className={`message ${mine ? 'message-mine' : 'message-theirs'}${lastOfRun ? ' is-last' : ''}`}>
                    {group && !mine && firstOfRun ? <span className="message-sender">{nameOf(m.sender_id)}</span> : <span className="visually-hidden">{mine ? 'You' : nameOf(m.sender_id)}: </span>}
                    <p className="message-body">{m.body}</p>
                    <time className={lastOfRun ? 'message-time' : 'message-time visually-hidden'} dateTime={m.created_at}>
                      {messageTime(m.created_at)}
                    </time>
                  </li>
                  {!mine && warnings.has(m.id) && (
                    <li className="scam-warning">
                      <p>
                        <strong>Never send money to someone you haven’t met.</strong> Report if this feels wrong.
                      </p>
                      {reporting === m.id ? (
                        <SafetyBox profileId={m.sender_id} name={nameOf(m.sender_id)} messageId={m.id} onCancel={() => setReporting(null)} onBlocked={blocked} />
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
          <Composer conversationId={conversationId} name={group ? 'the group' : other.display_name} onSent={add} onMore={() => setMenuOpen(true)} />
        ) : (
          <p className="notice">This conversation has ended. You can still read it.</p>
        )}
      </div>
    </Layout>
  )
}

/** The ⋯ menu as a sheet from the bottom: profile, plans and safety first, then block and report in red (Claude Design, 16 Oct). */
function ChatSheet({
  conversationId,
  other,
  group,
  onClose,
  onBlocked,
}: {
  conversationId: number
  other: Conversation
  group: Group | null
  onClose: () => void
  onBlocked: (message: string) => void
}) {
  const [step, setStep] = useState<'menu' | 'block' | 'report'>('menu')
  const isGroup = other.kind === 'group'
  const name = other.display_name
  const icon = { size: 22, strokeWidth: 1.8, 'aria-hidden': true } as const
  return (
    <SafetySheet
      name={name}
      onClose={onClose}
      body={
        step === 'menu' ? (
          <div className="sheet-menu">
            <ul className="sheet-list">
              {isGroup ? (
                <li>
                  <Link to={`/groups/${other.group_id}`}>
                    <UsersRound {...icon} />
                    Group info
                  </Link>
                </li>
              ) : (
                <li>
                  <Link to={`/connections/people/${other.profile_id}`}>
                    <UserRound {...icon} />
                    View profile
                  </Link>
                </li>
              )}
              {!isGroup && other.can_message && (
                <li>
                  <Link to={`/plan-together/${other.profile_id}`}>
                    <BriefcaseBusiness {...icon} />
                    Plan a trip together
                  </Link>
                </li>
              )}
              {isGroup && group && isTripGroup(group) && (
                <li>
                  <Link to={`/messages/${conversationId}/plan`}>
                    <ClipboardList {...icon} />
                    Plan board
                  </Link>
                </li>
              )}
              <li>
                <Link to={`/messages/${conversationId}/share`}>
                  <MapPin {...icon} />
                  Share where you’re meeting
                </Link>
              </li>
              <li>
                <Link to="/meeting-safely">
                  <ShieldCheck {...icon} />
                  Meeting up safely
                </Link>
              </li>
            </ul>
            {!isGroup && (
              <ul className="sheet-list sheet-list-danger">
                <li>
                  <button type="button" onClick={() => setStep('block')}>
                    <Ban {...icon} />
                    Block {name}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setStep('report')}>
                    <Flag {...icon} />
                    Report {name}
                  </button>
                </li>
              </ul>
            )}
            <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
              Cancel
            </button>
          </div>
        ) : (
          <SafetyBox
            profileId={other.profile_id!}
            name={name}
            startMode={step}
            onCancel={() => setStep('menu')}
            onBlocked={(message) => {
              onClose()
              onBlocked(message)
            }}
          />
        )
      }
    />
  )
}

/** Under a group chat's name: the plan board and everyone's dates for a trip group, and who's in it. */
function GroupOptions({
  conversationId,
  groupId,
  group,
  datesOpen,
  onDates,
  me,
}: {
  conversationId: number
  groupId: number
  group: Group | null
  datesOpen: boolean
  onDates: () => void
  me: string
}) {
  const trip = group && isTripGroup(group) ? group : null
  return (
    <>
      <nav className="chat-options" aria-label="Group">
        {trip && (
          <Link className="pill" to={`/messages/${conversationId}/plan`}>
            Plan board
          </Link>
        )}
        {trip && (
          <button type="button" className={datesOpen ? 'pill is-on' : 'pill'} aria-expanded={datesOpen} onClick={onDates}>
            Check dates
          </button>
        )}
        <Link className="pill" to={`/groups/${groupId}`}>
          Members
        </Link>
        {group && !trip && group.i_own && (
          <Link className="pill" to={`/groups/${groupId}?trip=1`}>
            Make it a trip
          </Link>
        )}
      </nav>
      {trip && datesOpen && <GroupDatesView group={trip} me={me} />}
    </>
  )
}

/** Everyone's dates for a trip group, on one timeline. */
function GroupDatesView({ group, me }: { group: Group & { city: string; start_date: string; end_date: string }; me: string }) {
  const [dates, setDates] = useState<GroupDates[] | null>(null)
  useEffect(() => {
    groupDates(group.id).then(setDates, () => setDates([]))
  }, [group.id])
  if (!dates) return <p className="hint chat-dates">Loading everyone’s dates…</p>
  const mine = dates.find((d) => d.profile_id === me)
  const others = dates.filter((d) => d.profile_id !== me).map((d) => ({ start: d.start_date, end: d.end_date, name: d.display_name }))
  return (
    <div className="chat-dates">
      <DateOverlap city={group.city} mine={mine ? { start: mine.start_date, end: mine.end_date } : { start: group.start_date, end: group.end_date }} others={others} />
      {others.length === 0 && <p className="hint">No one else has added their dates for {group.city} yet.</p>}
    </div>
  )
}

function Composer({ conversationId, name, onSent, onMore }: { conversationId: number; name: string; onSent: (m: Message[]) => void; onMore: () => void }) {
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
        <button type="button" className="composer-more" onClick={onMore} aria-label="Plans and safety">
          <AddIcon />
        </button>
        <label className="visually-hidden" htmlFor="message">
          Message {name}
        </label>
        <textarea
          ref={box}
          id="message"
          className="textarea composer-input"
          rows={1}
          maxLength={MAX_MESSAGE}
          placeholder="Write a message"
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
        <button type="submit" className="btn btn-primary composer-send" disabled={busy || !text.trim()} aria-label="Send">
          <ArrowUp size={22} strokeWidth={2.2} aria-hidden="true" />
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
    <aside className="meet-guide" aria-labelledby="guide-title">
      <div className="meet-guide-head">
        <span className="meet-guide-icon" aria-hidden="true">
          <ShieldCheck size={22} strokeWidth={2} />
        </span>
        <h2 id="guide-title">Before you meet</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="Got it, hide these tips"
          onClick={() => {
            markGuideSeen()
            setShow(false)
          }}
        >
          <CloseIcon size={20} />
        </button>
      </div>
      <ul>
        <li>Video call first</li>
        <li>Meet somewhere busy, in daylight</li>
        <li>Tell someone you trust</li>
        <li>Never send money</li>
      </ul>
      <Link className="meet-guide-link" to="/meeting-safely">
        Read the full guide
      </Link>
    </aside>
  )
}

/** Trips being planned with this person, at the top of your chat with them. */
function TripsTogether({ profileId, name, canPlan, onTrip }: { profileId: string; name: string; canPlan: boolean; onTrip: (line: string) => void }) {
  const [trips, setTrips] = useState<TripTogether[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(
    () =>
      tripsTogether(profileId).then((list) => {
        setTrips(list)
        const t = list[0]
        if (t) onTrip(`${t.city} · ${shortDates(t.start_date, t.end_date)}`)
      }),
    [profileId, onTrip],
  )
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
          <CityPhoto city={t.city} width={96} code className="together-photo" />
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
