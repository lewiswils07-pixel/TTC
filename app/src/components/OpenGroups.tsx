import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { shortDates } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { joinOpenGroup, openGroups, settingsLabel, type OpenGroup } from '../lib/groups'

/** Travel groups anyone who fits can join (Lewis, 13 Oct). On a trip page, `cityId` shows only groups going there. Hidden when there are none. */
export function OpenGroups({ cityId, title = 'Groups you can join' }: { cityId?: number; title?: string }) {
  const [groups, setGroups] = useState<OpenGroup[] | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    openGroups(cityId).then(setGroups, () => setGroups([]))
  }, [cityId])

  async function join(g: OpenGroup) {
    setBusy(g.id)
    setError(null)
    try {
      await joinOpenGroup(g.id)
      navigate(`/groups/${g.id}`, { state: { message: `You’ve joined ${g.name}. Say hello in the group chat.` } })
    } catch (e) {
      setError(messageOf(e))
      setBusy(null)
    }
  }

  if (!groups?.length) return null
  return (
    <section className="open-groups" aria-labelledby="open-groups-title">
      <h2 className="section-title" id="open-groups-title">
        {title}
      </h2>
      <p className="hint">Trip groups open to members like you. Join one and you’re in the group chat straight away.</p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <ul className="person-list">
        {groups.map((g) => {
          const who = settingsLabel(g)
          return (
            <li key={g.id} className="card group-card open-group">
              <span className="trip-text">
                <strong>{g.name}</strong>
                <span className="hint">
                  {g.city} · {shortDates(g.start_date, g.end_date)}
                </span>
                <span className="hint">
                  Started by {g.owner_name} · {g.members} joined
                  {g.going_when_you_are ? ' · Going when you are' : ''}
                </span>
                {who && <span className="tag">{who}</span>}
              </span>
              <button type="button" className="btn btn-primary btn-small" disabled={busy === g.id} onClick={() => join(g)} aria-label={`Join ${g.name}`}>
                {busy === g.id ? 'Joining…' : 'Join'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
