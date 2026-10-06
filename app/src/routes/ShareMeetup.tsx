import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { TextField } from '../components/Field'
import { Layout, Loading } from '../components/Layout'
import { myConversations, type Conversation } from '../lib/chat'
import { messageOf } from '../lib/errors'
import { useSession } from '../lib/session-context'
import { useMyProfile } from '../lib/useMyProfile'
import { checkIn, createShare, localInputValue, MAX_NOTE, MAX_PLACE, meetTime, myShares, sendLink, stopSharing, type MeetupShare } from '../lib/share'
import { useChecks } from '../lib/useChecks'

function checkPlace(place: string): string | null {
  return place.trim().length < 2 ? 'Please say where you’re meeting, such as the name of a café and the town.' : null
}

function checkWhen(when: string): string | null {
  if (!when) return 'Please pick the day and time you’re meeting.'
  const t = new Date(when).getTime()
  if (Number.isNaN(t)) return 'Please pick the day and time you’re meeting.'
  if (t < Date.now() - 12 * 60 * 60 * 1000) return 'That time has already passed.'
  if (t > Date.now() + 90 * 24 * 60 * 60 * 1000) return 'Links are for meet-ups in the next 3 months.'
  return null
}

/** Share a meet-up with someone you trust: who, where and when, and a check-in when you're back. */
export function ShareMeetup() {
  const conversationId = Number(useParams().id)
  const { session } = useSession()
  const { data: mine } = useMyProfile(session!.user.id)
  const [chat, setChat] = useState<Conversation | null | undefined>(undefined)
  const [shares, setShares] = useState<MeetupShare[]>([])
  const [place, setPlace] = useState('')
  const [when, setWhen] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const [earliest] = useState(() => localInputValue(new Date()))
  const { shown, touch, validateAll, reset } = useChecks({ place: checkPlace(place), when: checkWhen(when) })
  const me = mine?.profile.display_name ?? 'I'

  const reload = useCallback(() => myShares(conversationId).then(setShares), [conversationId])

  useEffect(() => {
    Promise.all([myConversations(), myShares(conversationId)]).then(
      ([all, list]) => {
        setChat(all?.find((c) => c.id === conversationId) ?? null)
        setShares(list)
        heading.current?.focus()
      },
      (e) => setError(messageOf(e)),
    )
  }, [conversationId])

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(null)
    }
  }

  function create(e: FormEvent) {
    e.preventDefault()
    if (!validateAll()) return
    void run('create', async () => {
      await createShare(conversationId, place.trim(), new Date(when), note.trim())
      await reload()
      setPlace('')
      setWhen('')
      setNote('')
      reset()
      setStatus('Your link is ready. Send it to someone you trust.')
    })
  }

  function send(share: MeetupShare) {
    void run(`send-${share.id}`, async () => {
      const result = await sendLink(share, me)
      if (result === 'copied') setStatus('Link copied. Paste it into a text or WhatsApp to someone you trust.')
      if (result === 'shared') setStatus('Link sent.')
    })
  }

  if (chat === undefined && !error) return <Loading />
  if (!chat) {
    return (
      <Layout>
        <h1>Chat not found</h1>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <Link className="btn btn-secondary" to="/messages">
          Back to messages
        </Link>
      </Layout>
    )
  }

  return (
    <Layout tab="chat">
      <Link className="back-link" to={`/messages/${conversationId}`}>
        ‹ {chat.display_name}
      </Link>
      <h1 ref={heading} tabIndex={-1}>
        Tell someone you trust
      </h1>
      <p className="lede">
        Make a private link for a friend or relative. It shows who you’re meeting, where and when, and you can let them know when you’re back safe.
      </p>
      <p className={status ? 'notice notice-success' : 'visually-hidden'} role="status">
        {status}
      </p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {shares.length > 0 && (
        <section aria-labelledby="links-title">
          <h2 id="links-title" className="section-title">
            Your links
          </h2>
          <ul className="share-list">
            {shares.map((s) => (
              <li key={s.id} className="card share-card">
                <p className="share-when">{meetTime(s.meet_at)}</p>
                <p className="share-place">{s.place}</p>
                <p className="hint">With {s.meeting_with.map((p) => p.name).join(', ') || 'your chat'}</p>
                {s.checked_in_at ? (
                  <p className="notice notice-success">You’ve checked in as back safe. Whoever has the link can see it.</p>
                ) : null}
                <div className="action-row">
                  <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => send(s)}>
                    {busy === `send-${s.id}` ? 'Opening…' : 'Send the link'}
                  </button>
                  {!s.checked_in_at && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(`in-${s.id}`, async () => {
                          await checkIn(s.id)
                          await reload()
                          setStatus('Checked in. The person you sent it to can see you’re back safe.')
                        })
                      }
                    >
                      I’m back safe
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-link safety-link"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(`stop-${s.id}`, async () => {
                      await stopSharing(s.id)
                      await reload()
                      setStatus('Link stopped. It no longer shows anything.')
                    })
                  }
                >
                  Stop sharing this link
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="card section-card" onSubmit={create} noValidate aria-labelledby="new-title">
        <h2 id="new-title">{shares.length ? 'Share another meet-up' : 'Your meet-up'}</h2>
        <p className="hint section-hint">
          You’re meeting {chat.kind === 'group' ? `your group, ${chat.display_name}` : chat.display_name}. Their first name, age, home town and member number go on the
          link, never their photo or contact details.
        </p>
        <TextField
          name="place"
          label="Where are you meeting?"
          hint="For example, “Café Nero by Leeds station”."
          maxLength={MAX_PLACE}
          value={place}
          error={shown('place')}
          onChange={(e) => {
            setPlace(e.target.value)
            if (shown('place')) touch('place')
          }}
          onBlur={() => touch('place')}
        />
        <TextField
          name="when"
          label="When?"
          type="datetime-local"
          min={earliest}
          value={when}
          error={shown('when')}
          onChange={(e) => {
            setWhen(e.target.value)
            touch('when')
          }}
        />
        <div className="field" data-field="note">
          <label htmlFor="share-note">Anything else? (optional)</label>
          <textarea
            id="share-note"
            className="textarea textarea-short"
            maxLength={MAX_NOTE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-describedby="share-note-hint"
          />
          <p className="hint" id="share-note-hint">
            For example, “I’ll text you by 6pm”.
          </p>
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy !== null}>
          {busy === 'create' ? 'Making your link…' : 'Make the link'}
        </button>
        <p className="hint center">The link stops working two days after you meet, or as soon as you stop sharing it.</p>
      </form>
    </Layout>
  )
}
