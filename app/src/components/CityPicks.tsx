import { useState } from 'react'
import { mapLink, type CityPicks as Picks, type PickKind } from '../data/picks'

const KIND: Record<PickKind, string> = {
  sight: 'Sight',
  museum: 'Museum',
  food: 'Food and drink',
  outdoors: 'Outdoors',
  experience: 'Experience',
}

type Props = {
  picks: Picks
  /** When given, each pick gets an “Add to the plan” button. */
  onAdd?: (title: string, url: string) => Promise<void>
  /** Titles already on the plan, shown as added. */
  added?: string[]
  /** Starts folded away, for pages where the list is extra. */
  folded?: boolean
}

/** Our hand-picked things to do in a city, with links and an optional “Add to the plan”. */
export function CityPicks({ picks, onAdd, added = [], folded = false }: Props) {
  const [open, setOpen] = useState(!folded)
  const [busy, setBusy] = useState<string | null>(null)
  const id = `picks-${picks.cityId}`
  const onPlan = new Set(added.map((t) => t.trim().toLowerCase()))

  return (
    <section className="city-picks" aria-labelledby={id}>
      <div className="city-picks-head">
        <h2 id={id} className="section-title">
          Things to do in {picks.city}
        </h2>
        {folded && (
          <button type="button" className="btn-link" aria-expanded={open} aria-controls={`${id}-list`} onClick={() => setOpen(!open)}>
            {open ? 'Hide' : `Show ${picks.picks.length} ideas`}
          </button>
        )}
      </div>
      {open && (
        <>
          <p className="hint section-hint">{picks.intro}</p>
          <ul id={`${id}-list`} className="pick-list">
            {picks.picks.map((pick) => {
              const isAdded = onPlan.has(pick.title.toLowerCase())
              return (
                <li key={pick.title} className="card pick">
                  <p className="pick-kind">{KIND[pick.kind]}</p>
                  <h3 className="pick-title">{pick.title}</h3>
                  <p className="pick-text">{pick.text}</p>
                  {pick.tip && <p className="pick-tip">Tip: {pick.tip}</p>}
                  <div className="pick-actions">
                    {onAdd &&
                      (isAdded ? (
                        <span className="pick-added">✓ On the plan</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          aria-label={`Add to the plan: ${pick.title}`}
                          disabled={busy !== null}
                          onClick={async () => {
                            setBusy(pick.title)
                            try {
                              await onAdd(pick.title, pick.url)
                            } finally {
                              setBusy(null)
                            }
                          }}
                        >
                          {busy === pick.title ? 'Adding…' : 'Add to the plan'}
                        </button>
                      ))}
                    <a className="idea-link" href={pick.url} target="_blank" rel="noopener noreferrer">
                      More about it<span className="visually-hidden"> – {pick.title} (opens in a new tab)</span>
                    </a>
                    <a className="idea-link" href={mapLink(pick, picks.city)} target="_blank" rel="noopener noreferrer">
                      Map<span className="visually-hidden"> of {pick.title} (opens in a new tab)</span>
                    </a>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
