import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Dropdown } from '../components/Dropdown'
import { CityPicks } from '../components/CityPicks'
import { TextField } from '../components/Field'
import { useConfirm } from '../lib/useConfirm'
import { Layout, Loading } from '../components/Layout'
import { PICKS, picksFor } from '../data/picks'
import { addIdea, checkIdea, dayLabel, deleteIdea, editIdea, MAX_IDEA, planBoard, setDone, toggleVote, type Idea } from '../lib/board'
import { IdeaEditor } from '../components/TripPlanner'
import { myConversations, type Conversation } from '../lib/chat'
import { daysBetween } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { groupPeople, isTripGroup, myGroups, type GroupPerson } from '../lib/groups'
import { Avatar } from '../components/Avatar'
import { useChecks } from '../lib/useChecks'

type Trip = { start: string; days: number } | null

/** The shared plan board for one chat: add ideas, vote, tick them off. */
export function PlanBoard() {
  const { ask, dialog: confirmDialog } = useConfirm()
  const conversationId = Number(useParams().id)
  const [chat, setChat] = useState<Conversation | null | undefined>(undefined)
  const [trip, setTrip] = useState<Trip>(null)
  const [guide, setGuide] = useState<number | ''>('')
  const [groupCity, setGroupCity] = useState<string | number | null>(null)
  const [members, setMembers] = useState<GroupPerson[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)

  const reload = useCallback(() => planBoard(conversationId).then(setIdeas), [conversationId])

  useEffect(() => {
    Promise.all([myConversations(), planBoard(conversationId)]).then(
      async ([all, list]) => {
        const found = all?.find((c) => c.id === conversationId) ?? null
        if (found?.kind === 'group') {
          const g = (await myGroups())?.find((x) => x.id === found.group_id)
          void groupPeople(found.group_id!).then(
            (p) => setMembers(p.filter((x) => x.status === 'joined')),
            () => undefined,
          )
          if (g && isTripGroup(g)) {
            setTrip({ start: g.start_date, days: daysBetween(g.start_date, g.end_date) + 1 })
            setGroupCity(g.city_id ?? g.city)
          }
        }
        setChat(found)
        setIdeas(list)
        heading.current?.focus()
      },
      (e) => setError(messageOf(e)),
    )
  }, [conversationId])

  /** Runs an action. `optimistic` updates the idea on screen straight away; the list is reloaded either way. */
  async function act(id: number, action: () => Promise<void>, message: string, optimistic?: (i: Idea) => Idea) {
    setBusy(id)
    setError(null)
    if (optimistic) setIdeas((list) => list.map((i) => (i.id === id ? optimistic(i) : i)))
    try {
      await action()
      setStatus(message)
    } catch (e) {
      setError(messageOf(e))
    } finally {
      await reload().catch(() => undefined)
      setBusy(null)
    }
  }

  if (chat === undefined && !error) return <Loading />
  if (!chat) {
    return (
      <Layout>
        <h1>Plan board not found</h1>
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

  const todo = ideas.filter((i) => !i.done)
  const done = ideas.filter((i) => i.done)
  const who = chat.kind === 'group' ? chat.display_name : `You and ${chat.display_name}`

  const card = (idea: Idea) => (
    <li key={idea.id} className={`card idea${idea.done ? ' is-done' : ''}`}>
      {editing === idea.id ? (
        <IdeaEditor
          item={idea}
          days={Math.min(trip?.days ?? 14, 91)}
          start={trip?.start ?? null}
          canEditTitle={idea.mine}
          onCancel={() => setEditing(null)}
          onSave={(title, day) => {
            setEditing(null)
            void act(
              idea.id,
              () => editIdea(idea.id, title, day),
              `${title} saved.`,
              (i) => ({ ...i, title, day }),
            )
          }}
        />
      ) : (
        <div className="idea-tick">
          <input
            type="checkbox"
            checked={idea.done}
            aria-label={idea.done ? `Done: ${idea.title}` : `Mark ${idea.title} done`}
            disabled={!chat.can_message || busy === idea.id}
            onChange={(e) => {
              const on = e.target.checked
              void act(
                idea.id,
                () => setDone(idea.id, on),
                on ? `Ticked off ${idea.title}.` : `${idea.title} is back on the list.`,
                (i) => ({ ...i, done: on }),
              )
            }}
          />
          <span className="idea-title">{idea.title}</span>
        </div>
      )}
      <p className="idea-meta">
        {idea.day ? dayLabel(idea.day, trip?.start) : 'Any day'}
        {idea.added_by && ` · added by ${idea.mine ? 'you' : idea.added_by}`}
      </p>
      <div className="idea-actions">
        <button
          type="button"
          className={`vote${idea.i_voted ? ' is-on' : ''}`}
          aria-pressed={idea.i_voted}
          aria-label={`Vote for ${idea.title}. ${idea.votes} ${idea.votes === 1 ? 'vote' : 'votes'}.`}
          disabled={!chat.can_message || busy === idea.id}
          onClick={() =>
            act(
              idea.id,
              () => toggleVote(idea.id),
              idea.i_voted ? 'Vote removed.' : 'Vote added.',
              (i) => ({
                ...i,
                i_voted: !i.i_voted,
                votes: i.votes + (i.i_voted ? -1 : 1),
              }),
            )
          }
        >
          <span aria-hidden="true">👍 {idea.votes}</span>
        </button>
        {idea.source_url && (
          <a className="idea-link" href={idea.source_url} target="_blank" rel="noopener noreferrer">
            Open link<span className="visually-hidden"> for {idea.title} (opens in a new tab)</span>
          </a>
        )}
        {chat.can_message && editing !== idea.id && (
          <button type="button" className="btn-link safety-link" onClick={() => setEditing(idea.id)} aria-label={`Edit ${idea.title}`}>
            Edit
          </button>
        )}
        {idea.mine && chat.can_message && (
          <button
            type="button"
            className="btn-link safety-link"
            disabled={busy === idea.id}
            onClick={async () =>
              (await ask({ title: `Remove “${idea.title}” from the plan?`, confirmLabel: 'Remove', danger: true })) && act(idea.id, () => deleteIdea(idea.id), `${idea.title} removed.`)
            }
          >
            Remove
          </button>
        )}
      </div>
    </li>
  )

  return (
    <Layout>
      {confirmDialog}
      <Link className="back-link" to={`/messages/${conversationId}`}>
        ‹ Back to the chat
      </Link>
      <p className="eyebrow">{who}</p>
      <h1 ref={heading} tabIndex={-1}>
        Plan board
      </h1>
      <p className="lede">Add ideas for things to do, vote for your favourites and tick them off as you go.</p>
      {chat.kind === 'group' && members.length > 0 && (
        <Link className="card link-card board-members" to={`/groups/${chat.group_id}`} aria-label={`Who’s in ${chat.display_name}`}>
          <span className="board-faces" aria-hidden="true">
            {members.slice(0, 5).map((p) => (
              <Avatar key={p.profile_id} name={p.display_name} path={p.photo_path} size="sm" />
            ))}
          </span>
          <span className="board-names">
            <strong>Who’s in it</strong>
            <span>{members.map((p) => p.display_name).join(', ')}</span>
          </span>
          <span className="trip-chevron" aria-hidden="true">
            ›
          </span>
        </Link>
      )}
      <p className="visually-hidden" role="status">
        {status}
      </p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {chat.can_message ? (
        <AddIdea conversationId={conversationId} days={trip?.days ?? 14} start={trip?.start} onAdded={(title) => reload().then(() => setStatus(`${title} added.`))} />
      ) : (
        <p className="notice">This conversation has ended, so the plan can’t be changed. You can still read it.</p>
      )}

      <h2 className="section-title">To do{todo.length ? ` (${todo.length})` : ''}</h2>
      {todo.length === 0 ? <p className="hint section-hint">No ideas yet. Add the first one above.</p> : <ul className="idea-list">{todo.map(card)}</ul>}

      {done.length > 0 && (
        <>
          <h2 className="section-title">Done ({done.length})</h2>
          <ul className="idea-list">{done.map(card)}</ul>
        </>
      )}

      {chat.can_message && (
        <Ideas
          picks={groupCity ? picksFor(groupCity) : undefined}
          guide={guide}
          onGuide={setGuide}
          added={ideas.map((i) => i.title)}
          onAdd={async (title, url) => {
            setError(null)
            try {
              await addIdea(conversationId, title, null, url)
              await reload()
              setStatus(`${title} added to the plan.`)
            } catch (e) {
              setError(messageOf(e))
            }
          }}
        />
      )}
    </Layout>
  )
}

function AddIdea({ conversationId, days, start, onAdded }: { conversationId: number; days: number; start?: string; onAdded: (title: string) => void }) {
  const [title, setTitle] = useState('')
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { shown, touch, validateAll, reset } = useChecks({ idea: checkIdea(title) })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!validateAll()) return
    setBusy(true)
    setError(null)
    try {
      // No link box any more (Lewis, 11 Oct): just the idea and a day.
      await addIdea(conversationId, title, day ? Number(day) : null, '')
      onAdded(title.trim())
      setTitle('')
      setDay('')
      reset()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card form-card add-idea" onSubmit={submit} noValidate aria-labelledby="add-idea">
      <h2 id="add-idea" className="section-title">
        Add an idea
      </h2>
      <TextField
        name="idea"
        label="What’s the idea?"
        hint={`For example, “Sunset at the Miradouro”. ${MAX_IDEA - title.length} characters left.`}
        maxLength={MAX_IDEA}
        value={title}
        error={shown('idea')}
        onChange={(e) => {
          setTitle(e.target.value)
          touch('idea')
        }}
        onBlur={() => touch('idea')}
      />
      <div className="field">
        <label htmlFor="idea-day">Which day? (optional)</label>
        <Dropdown
          id="idea-day"
          value={day}
          placeholder="Any day"
          groups={[{ options: [{ value: '', label: 'Any day' }, ...Array.from({ length: Math.min(days, 91) }, (_, i) => ({ value: String(i + 1), label: dayLabel(i + 1, start) }))] }]}
          onChange={setDay}
        />
      </div>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Adding…' : 'Add to the plan'}
      </button>
    </form>
  )
}

/** Hand-picked ideas: the group's city, or a city guide the pair chooses. */
function Ideas({
  picks,
  guide,
  onGuide,
  added,
  onAdd,
}: {
  picks?: ReturnType<typeof picksFor>
  guide: number | ''
  onGuide: (id: number | '') => void
  added: string[]
  onAdd: (title: string, url: string) => Promise<void>
}) {
  if (picks) return <CityPicks picks={picks} added={added} onAdd={onAdd} folded />
  const chosen = guide === '' ? undefined : picksFor(guide)
  return (
    <section className="city-picks" aria-labelledby="guides">
      <h2 id="guides" className="section-title">
        Need ideas?
      </h2>
      <div className="field">
        <label htmlFor="guide-city">See our picks for a city</label>
        <Dropdown
          id="guide-city"
          value={guide === '' ? '' : String(guide)}
          placeholder="Choose a city"
          columns={2}
          groups={[{ options: [...PICKS].sort((a, b) => a.city.localeCompare(b.city)).map((c) => ({ value: String(c.cityId), label: c.city })) }]}
          onChange={(v) => onGuide(v ? Number(v) : '')}
        />
      </div>
      {chosen && <CityPicks picks={chosen} added={added} onAdd={onAdd} />}
    </section>
  )
}
