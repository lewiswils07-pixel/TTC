import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { shortDates } from '../lib/dates'
import { CityPhoto } from './CityPhoto'
import { messageOf } from '../lib/errors'
import { joinOpenGroup, openGroups, type OpenGroup } from '../lib/groups'

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
      // Joining adds the group's dates to your trips unless you already have one there then (Kai, 13 Oct: say so).
      navigate(`/groups/${g.id}`, { state: { message: `You’ve joined ${g.name}. ${g.city} ${shortDates(g.start_date, g.end_date)} is now in your trips.` } })
    } catch (e) {
      setError(messageOf(e))
      setBusy(null)
    }
  }

  if (!groups?.length) return null
  return (
    <section className="open-groups" aria-labelledby="open-groups-title">
      <h2 className="list-label" id="open-groups-title">
        {title}
      </h2>
      <p className="hint list-hint">Open to members like you. Join and you’re in the group chat straight away.</p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <ul className="open-group-list">
        {groups.map((g) => {
          const tags = [
            g.women_only ? 'Women only' : null,
            g.age_min && g.age_max ? `Ages ${g.age_min}–${g.age_max}` : g.age_min ? `Ages ${g.age_min}+` : g.age_max ? `Ages up to ${g.age_max}` : null,
            g.going_when_you_are ? 'Going when you are' : null,
          ].filter(Boolean)
          return (
            <li key={g.id} className="card open-group">
              <div className="open-group-head">
                <CityPhoto city={g.city} width={120} code className="group-tile" />
                <span className="open-group-text">
                  <strong>{g.name}</strong>
                  <span>
                    {shortDates(g.start_date, g.end_date)} · {g.members} of {g.max_people} places
                  </span>
                  <span className="hint">Started by {g.owner_name}</span>
                </span>
              </div>
              <div className="open-group-foot">
                <span className="open-group-tags">
                  {tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </span>
                <button type="button" className="btn btn-outline btn-small" disabled={busy === g.id} onClick={() => join(g)} aria-label={`Join ${g.name}`}>
                  {busy === g.id ? 'Joining…' : 'Join'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
