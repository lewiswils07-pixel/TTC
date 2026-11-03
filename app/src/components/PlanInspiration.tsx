import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { brand } from '../lib/brand'
import { monthName } from '../lib/dates'
import { hasPlus, plusLink } from '../lib/plan'
import { planInspiration, type Inspiration } from '../lib/trips'

const SHOWN_IDEAS = 4

/** Sodalis+ on the Trips tab: other members' trip plans, with no names, for ideas of your own. */
export function PlanInspiration() {
  const [plus, setPlus] = useState<boolean | null>(null)
  const [plans, setPlans] = useState<Inspiration[] | null>(null)

  useEffect(() => {
    hasPlus().then((p) => {
      setPlus(p)
      if (p) planInspiration().then(setPlans, () => setPlans([]))
    })
  }, [])

  if (plus === null || (plus && !plans?.length)) return null
  return (
    <section className="inspiration" aria-labelledby="inspiration-title">
      <div className="plus-head">
        <h2 className="section-title" id="inspiration-title">
          Trip plans for inspiration
        </h2>
        <span className="tag tag-plus">{brand.plusName}</span>
      </div>
      {!plus ? (
        <p className="hint">
          See what other members are planning on their trips, for ideas of your own. <Link to={plusLink('inspiration')}>Comes with {brand.plusName}</Link>
        </p>
      ) : (
        <ul className="inspiration-list">
          {plans!.map((p) => (
            <li key={p.trip_id} className="card inspiration-card">
              <strong>{p.city}</strong>
              <span className="hint">
                {monthName(p.month)} · {p.nights === 1 ? '1 night' : `${p.nights} nights`}
              </span>
              <ul>
                {p.ideas.slice(0, SHOWN_IDEAS).map((idea, i) => (
                  <li key={i}>{idea}</li>
                ))}
              </ul>
              {p.ideas.length > SHOWN_IDEAS && <span className="hint">and {p.ideas.length - SHOWN_IDEAS} more</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
