import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Gem, Sparkles } from 'lucide-react'
import { brand } from '../lib/brand'
import { CityPhoto } from './CityPhoto'
import { NextIcon } from './Icons'
import { messageOf } from '../lib/errors'
import { joinSuggestedGroup, suggestedGroups, SUGGESTED_FREE, type SuggestedGroup } from '../lib/groups'
import { hasPlus, plusLink } from '../lib/plan'

const PLUS_SHOWN = 6

/** Groups for your trips, wish list and interests, run by the club (round 8 testers, 23 Oct: "ready-made groups I can join in one tap").
 *  Free members see and join SUGGESTED_FREE of them; Sodalis+ unlocks the rest. */
export function SuggestedGroups({ joined, onJoined }: { joined: number; onJoined?: () => void }) {
  const [groups, setGroups] = useState<SuggestedGroup[] | null>(null)
  const [plus, setPlus] = useState<boolean | null>(null)
  const [all, setAll] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    suggestedGroups().then(setGroups, () => setGroups([]))
    hasPlus().then(setPlus, () => setPlus(false))
  }, [])

  if (!groups?.length || plus === null) return null
  // Free members can be in SUGGESTED_FREE suggested groups, so they see that many to pick from.
  const freeLeft = Math.max(SUGGESTED_FREE - joined, 0)
  const shown = plus ? (all ? groups : groups.slice(0, PLUS_SHOWN)) : groups.slice(0, freeLeft)
  const locked = plus ? 0 : groups.length - shown.length

  async function join(g: SuggestedGroup) {
    const key = `${g.kind}-${g.topic_id}`
    setBusy(key)
    setError(null)
    try {
      const id = await joinSuggestedGroup(g)
      onJoined?.()
      navigate(`/groups/${id}`, { state: { message: `You’ve joined ${g.name}. Say hello in the group chat.` } })
    } catch (e) {
      setError(messageOf(e))
      setBusy(null)
    }
  }

  return (
    <section className="suggested-groups" aria-labelledby="suggested-groups-title">
      <h2 className="list-label" id="suggested-groups-title">
        Groups for you
      </h2>
      <p className="hint list-hint">Based on your trips and interests. Join in one tap and say hello in the group chat.</p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {shown.length > 0 && (
        <ul className="open-group-list">
          {shown.map((g) => {
            const key = `${g.kind}-${g.topic_id}`
            const count =
              g.members > 0 ? `${g.members} ${g.members === 1 ? 'member' : 'members'}` : g.fans > 1 ? `${g.fans} members ${g.kind === 'place' ? 'going' : 'like this'}` : 'Be the first to join'
            return (
              <li key={key} className="card open-group suggested-group">
                <div className="open-group-head">
                  {g.kind === 'place' ? (
                    <CityPhoto city={g.name.replace(/ travellers$/, '')} width={120} code className="group-tile" />
                  ) : (
                    <span className="avatar avatar-md avatar-square avatar-group group-tile" aria-hidden="true">
                      <Sparkles size={22} strokeWidth={1.8} />
                    </span>
                  )}
                  <span className="open-group-text">
                    <strong>{g.name}</strong>
                    <span>{count}</span>
                    <span className="hint">{g.reason}</span>
                  </span>
                  <button type="button" className="btn btn-outline btn-small" disabled={busy === key} onClick={() => join(g)} aria-label={`Join ${g.name}`}>
                    {busy === key ? 'Joining…' : 'Join'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {plus && groups.length > PLUS_SHOWN && (
        <button type="button" className="btn-link" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${groups.length}`}
        </button>
      )}
      {locked > 0 && (
        <Link className="card trips-row trips-row-plus" to={plusLink('groups')}>
          <span className="trips-row-icon" aria-hidden="true">
            <Gem size={20} strokeWidth={1.8} />
          </span>
          <span className="trips-row-text">
            <strong>
              {locked} more {locked === 1 ? 'group' : 'groups'} for you <span className="tag tag-plus">{brand.plusName}</span>
            </strong>
            <span>
              {shown.length ? `Free members can be in ${SUGGESTED_FREE} groups like these.` : `You’re in ${SUGGESTED_FREE} groups, the most on the free plan.`} Join as many as you like with{' '}
              {brand.plusName}.
            </span>
          </span>
          <NextIcon />
        </Link>
      )}
    </section>
  )
}
