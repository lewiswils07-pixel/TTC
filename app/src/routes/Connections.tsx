import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Layout } from '../components/Layout'
import { ChatNav } from '../components/SubNav'
import { Avatar } from '../components/Avatar'
import { useConfirm } from '../lib/useConfirm'
import { SafetyMenu } from '../components/SafetyBox'
import { SkeletonRows } from '../components/Skeleton'
import { loadTabCounts, refreshTabCounts } from '../lib/tabCounts'
import type { Conversation } from '../lib/chat'
import { messageOf } from '../lib/errors'
import { homeLabel } from '../lib/matching'
import { peek, remember } from '../lib/cache'
import { myConnections, respondToRequest, withdrawRequest, type Connection } from '../lib/connections'
import { ageLabel } from '../lib/options'
import { myBlocks, unblockMember, type BlockedMember } from '../lib/safety'
import { NextIcon } from '../components/Icons'
import { Info, Plane, UserPlus } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { monthName } from '../lib/dates'
import { brand } from '../lib/brand'
import { hasPlus, loadRequests, PLUS_SHOW_LEFT_BELOW } from '../lib/plan'
import { RequestShare } from '../components/RequestShare'
import { useSession } from '../lib/session-context'
import { useMyProfile } from '../lib/useMyProfile'

/**
 * Connections on the Chat tab. "other" sits under Chats: people you're connected
 * with but haven't talked to yet. "requests" is the Requests page: requests for
 * you, requests you've sent, and anyone you've blocked.
 */
export function ConnectionsSections({
  show,
  conversations,
  onChanged,
  onMessage,
}: {
  show: 'other' | 'requests'
  conversations?: Conversation[] | null
  onChanged?: () => void
  onMessage: (message: string) => void
}) {
  const { ask, dialog: confirmDialog } = useConfirm()
  const [items, setItems] = useState<Connection[] | null>(() => peek('connections') ?? null)
  const { session } = useSession()
  const mine = useMyProfile(session!.user.id).data?.profile
  const [plus, setPlus] = useState(false)
  useEffect(() => {
    hasPlus().then(setPlus)
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | string | null>(null)
  const [status, setStatus] = useState('')
  const [blocked, setBlocked] = useState<BlockedMember[] | null>(() => peek('blocks') ?? null)

  const load = useCallback(
    () =>
      Promise.all([remember('connections', myConnections()), remember('blocks', myBlocks())]).then(
        ([c, b]) => {
          setItems(c)
          setBlocked(b)
        },
        (e) => setError(messageOf(e)),
      ),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])

  function blockedOne(message: string) {
    onMessage(message)
    void load()
    onChanged?.()
  }

  async function act(key: number | string, action: () => Promise<void>, message: string) {
    setBusy(key)
    setError(null)
    try {
      await action()
      setStatus(message)
      refreshTabCounts()
      await load()
      onChanged?.()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(null)
    }
  }

  const received = items?.filter((c) => c.status === 'pending' && c.direction === 'received') ?? []
  const sent = items?.filter((c) => c.status === 'pending' && c.direction === 'sent') ?? []
  // A chat opens for every connection; once either of you writes, it moves up into Chats.
  const chatFor = new Map((conversations ?? []).flatMap((x) => (x.kind === 'direct' && x.profile_id ? [[x.profile_id, x] as const] : [])))
  const quiet = items?.filter((c) => c.status === 'accepted' && !chatFor.get(c.profile_id)?.last_body) ?? []

  return (
    <>
      {confirmDialog}
      <p className="visually-hidden" role="status">
        {status}
      </p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {show === 'requests' && (
        <section aria-labelledby="requests-title">
          <h2 className="visually-hidden" id="requests-title">
            Requests for you
          </h2>
          {received.length > 0 && <p className="lede requests-lede">Members who’d like to connect with you.</p>}
          {received.length === 0 && items && (
            <EmptyState icon={<UserPlus size={18} strokeWidth={2} />} title="No requests right now" text="When a member asks to connect, you’ll see it here. Adding a trip helps people find you.">
              <Link className="btn btn-primary btn-block" to="/trips/new">
                Add a trip
              </Link>
              <Link className="btn btn-secondary btn-block" to="/messages">
                Back to your chats
              </Link>
            </EmptyState>
          )}
          <ul className="request-list">
            {received.map((c) => (
              <li key={c.id} className="card request-card">
                {c.trip_city && (
                  <p className="request-banner">
                    <Plane size={20} strokeWidth={1.8} aria-hidden="true" />
                    Also going to {c.trip_city}
                    {c.trip_start ? ` in ${monthName(c.trip_start)}` : ''}
                  </p>
                )}
                <div className="request-body">
                  <div className="request-who">
                    <Avatar name={c.display_name} path={c.photo_path} size="lg" square />
                    <div>
                      <h3>
                        {c.display_name}
                        {c.birth_year ? `, ${ageLabel(c.birth_year)}` : ''}
                      </h3>
                      {homeLabel(c) && <p>{homeLabel(c)}</p>}
                    </div>
                    <SafetyMenu profileId={c.profile_id} name={c.display_name} onBlocked={blockedOne} />
                  </div>
                  <RequestShare profileId={c.profile_id} name={c.display_name} mine={mine} plus={plus} />
                  {c.note && <blockquote className="request-note">“{c.note}”</blockquote>}
                  <div className="action-row">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy === c.id}
                      onClick={() => act(c.id, () => respondToRequest(c.id, false), `You said no thanks to ${c.display_name}.`)}
                    >
                      Not now
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy === c.id}
                      onClick={() => act(c.id, () => respondToRequest(c.id, true), `You’re now connected with ${c.display_name}.`)}
                    >
                      Accept
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <RequestsLeft />
        </section>
      )}

      {!items && !error && <SkeletonRows rows={2} label="Loading your connections…" />}

      {show === 'other' && quiet.length > 0 && (
        <section aria-labelledby="other-title">
          <h2 className="section-title" id="other-title">
            Other connections
          </h2>
          <p className="hint section-hint">
            You’re connected but haven’t chatted yet. Before you meet, read our tips for <Link to="/meeting-safely">meeting up safely</Link>.
          </p>
          <ul className="chat-list">
            {quiet.map((c) => {
              const chat = chatFor.get(c.profile_id)
              return (
                <li key={c.id} className="chat-row quiet-row">
                  <Link className="quiet-who" to={`/connections/people/${c.profile_id}`} aria-label={`View ${c.display_name}’s profile`}>
                    <Avatar name={c.display_name} path={c.photo_path} square />
                    <span className="chat-row-text">
                      <strong>{c.display_name}</strong>
                      <span className="chat-row-last">{[c.birth_year && ageLabel(c.birth_year), homeLabel(c)].filter(Boolean).join(' · ')}</span>
                    </span>
                  </Link>
                  {chat ? (
                    <Link className="btn btn-primary btn-small" to={`/messages/${chat.id}`} aria-label={`Say hello to ${c.display_name}`}>
                      Say hello
                    </Link>
                  ) : (
                    <span className="hint">Setting up…</span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {show === 'requests' && sent.length > 0 && (
        <section aria-labelledby="sent-title">
          <h2 className="section-title" id="sent-title">
            Waiting for a reply
          </h2>
          <ul className="person-list">
            {sent.map((c) => (
              <PersonCard key={c.id} item={c} onBlocked={blockedOne}>
                <button
                  type="button"
                  className="btn-link"
                  disabled={busy === c.id}
                  onClick={async () =>
                    (await ask({
                      title: `Withdraw your request to ${c.display_name}?`,
                      message: 'It still counts towards this week’s requests.',
                      confirmLabel: 'Withdraw request',
                    })) && act(c.id, () => withdrawRequest(c.id), `Request to ${c.display_name} withdrawn.`)
                  }
                >
                  Withdraw request
                </button>
              </PersonCard>
            ))}
          </ul>
        </section>
      )}

      {show === 'requests' && blocked && blocked.length > 0 && (
        <section aria-labelledby="blocked">
          <h2 className="section-title" id="blocked">
            Blocked
          </h2>
          <p className="hint section-hint">You can’t see each other. If you unblock someone, you’ll both see each other again.</p>
          <ul className="blocked-list">
            {blocked.map((b) => (
              <li key={b.profile_id} className="card">
                <span>{b.display_name}</span>
                <button
                  type="button"
                  className="btn-link"
                  disabled={busy === b.profile_id}
                  aria-label={`Unblock ${b.display_name}`}
                  onClick={() => act(b.profile_id, () => unblockMember(b.profile_id), `${b.display_name} is unblocked.`)}
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function PersonCard({
  item,
  children,
  onBlocked,
  profileLink = false,
}: {
  item: Connection
  children: ReactNode
  onBlocked: (message: string) => void
  /** Connected people: the name and photo open their full profile. */
  profileLink?: boolean
}) {
  const home = homeLabel(item)
  const who = (
    <>
      <Avatar name={item.display_name} path={item.photo_path} />
      <div className="match-who">
        <h3>{item.display_name}</h3>
        <p className="profile-meta">
          {item.birth_year ? `Age ${ageLabel(item.birth_year)}` : null}
          {home && ` · ${home}`}
        </p>
        {profileLink && (
          <span className="match-view">
            View profile <NextIcon />
          </span>
        )}
      </div>
    </>
  )
  return (
    <li className="card person-card">
      {profileLink ? (
        <Link className="match-head match-head-link" to={`/connections/people/${item.profile_id}`} aria-label={`View ${item.display_name}’s profile`}>
          {who}
        </Link>
      ) : (
        <div className="match-head">{who}</div>
      )}
      {item.note && <blockquote className="person-note">{item.note}</blockquote>}
      {children}
      <SafetyMenu profileId={item.profile_id} name={item.display_name} onBlocked={onBlocked} />
    </li>
  )
}

/** How many requests you can still send this week, under your requests (Claude Design, 16 Oct). Quiet for Sodalis+ until near the weekly guard. */
function RequestsLeft() {
  const [left, setLeft] = useState<{ left: number; plus: boolean; show: boolean } | null>(null)
  useEffect(() => {
    loadRequests().then(
      (r) => setLeft({ left: r.left, plus: r.plus, show: !r.plus || r.left <= PLUS_SHOW_LEFT_BELOW }),
      () => undefined,
    )
  }, [])
  if (!left?.show) return null
  return (
    <p className="requests-left">
      <Info size={20} strokeWidth={1.8} aria-hidden="true" />
      <span>
        You can send {left.left} more connection {left.left === 1 ? 'request' : 'requests'} this week.
        {!left.plus && (
          <>
            {' '}
            <Link to="/profile?tab=plus" className="plus-word">
              {brand.plusName}
            </Link>{' '}
            members have no limit.
          </>
        )}
      </span>
    </p>
  )
}

/** The Requests page on the Chat tab. */
export function Requests() {
  const heading = useRef<HTMLHeadingElement>(null)
  const [done, setDone] = useState((useLocation().state as { message?: string } | null)?.message)
  const [count, setCount] = useState<number | undefined>(undefined)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  return (
    <Layout tab="chat">
      <h1 ref={heading} tabIndex={-1}>
        Chat
      </h1>
      <ChatNav current="/requests" requests={count} />
      {done && (
        <p className="notice notice-success" role="status">
          {done}
        </p>
      )}
      <ConnectionsSections show="requests" onMessage={setDone} onChanged={() => loadTabCounts().then((c) => setCount(c.requests ?? 0))} />
    </Layout>
  )
}
