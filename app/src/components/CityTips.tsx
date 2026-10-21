import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { brand } from '../lib/brand'
import { longDate } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { hasPlus, plusLink } from '../lib/plan'
import { rules } from '../lib/rules'
import { addTip, checkTip, cityTips, deleteTip, TIP_CATEGORIES, tipLabel, type NewTip, type Tip, type TipCategory } from '../lib/tips'
import { useConfirm } from '../lib/useConfirm'
import { ChipChoice } from './ChipChoice'
import { FieldError } from './Field'
import { SafetyMenu } from './SafetyBox'

/** "★★★★☆" for a rating, read out as "4 out of 5 stars". */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>
      <span aria-hidden="true">{'★'.repeat(rating)}</span>
      <span className="stars-off" aria-hidden="true">
        {'★'.repeat(5 - rating)}
      </span>
    </span>
  )
}

/** Nice to know: tips members share from their trips, by kind. Sodalis+ members can pick a kind and search.
 *  `opensOn` is the day your trip starts, when that's still to come: tips are from people who've been. */
export function CityTips({ cityId, city, opensOn }: { cityId: number; city: string; opensOn?: string }) {
  const { ask, dialog } = useConfirm()
  const [tips, setTips] = useState<Tip[] | null>(null)
  const [plus, setPlus] = useState(false)
  const [category, setCategory] = useState<TipCategory | null>(null)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const reload = useCallback(() => cityTips(cityId, category, query).then(setTips), [cityId, category, query])
  useEffect(() => {
    hasPlus()
      .then(setPlus)
      .catch(() => {})
  }, [])
  useEffect(() => {
    const t = setTimeout(() => reload().catch((e) => setError(messageOf(e))), query ? 300 : 0)
    return () => clearTimeout(t)
  }, [reload, query])

  const filtering = plus && (category || query.trim())

  return (
    <div className="city-tips">
      {dialog}
      <p className="visually-hidden" role="status">
        {status}
      </p>
      <p className="hint section-hint">Members’ favourite places in {city}, from their own trips.</p>

      {opensOn ? (
        <p className="card review-later">You can share your own tips once your trip starts, on {longDate(opensOn)}.</p>
      ) : adding ? (
        <TipForm
          city={city}
          onCancel={() => setAdding(false)}
          onSave={async (t) => {
            await addTip(cityId, t)
            setAdding(false)
            setStatus('Thanks, your tip is shared.')
            await reload()
          }}
        />
      ) : (
        <button type="button" className="btn btn-secondary tip-add" onClick={() => setAdding(true)}>
          Share a tip
        </button>
      )}

      {plus ? (
        <div className="tip-filters">
          <label htmlFor="tip-search" className="visually-hidden">
            Search tips
          </label>
          <input id="tip-search" type="search" className="input input-search" placeholder="Search, e.g. tapas or rooftop" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="chips chips-compact chips-light" role="group" aria-label="Kind of tip">
            {TIP_CATEGORIES.map((o) => (
              <label className="chip" key={o.value}>
                <input type="checkbox" checked={category === o.value} onChange={() => setCategory(category === o.value ? null : o.value)} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="card tip-plus">
          <span className="tag tag-plus">{brand.plusName}</span> Search tips and pick a kind, like Food or Museums. <Link to={plusLink('tips')}>Comes with {brand.plusName}</Link>
        </p>
      )}

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {!tips ? (
        !error && <div className="skeleton-block" aria-hidden="true" />
      ) : tips.length === 0 ? (
        <p className="hint section-hint">{filtering ? 'No tips match that yet.' : `No tips about ${city} yet.${opensOn ? '' : ' Yours could be the first.'}`}</p>
      ) : (
        <ul className="review-list">
          {tips.map((t) => (
            <li key={t.id} className={t.mine ? 'card review tip is-mine' : 'card review tip'}>
              <p className="review-head">
                <strong>{t.place}</strong>
                {t.rating && <Stars rating={t.rating} />}
              </p>
              <p className="review-meta">
                <span className="tag tag-muted">{tipLabel(t.category)}</span>
                <span className="hint">{t.mine ? 'Your tip' : t.author}</span>
                {!t.mine && t.went_on_trip && <span className="hint">· Been on a trip here</span>}
              </p>
              {t.body && <p className="review-body">{t.body}</p>}
              {t.mine ? (
                <div className="review-actions">
                  <button
                    type="button"
                    className="btn-link btn-danger-link"
                    onClick={async () => {
                      if (!(await ask({ title: `Delete your tip about ${t.place}?`, confirmLabel: 'Delete', danger: true }))) return
                      setError(null)
                      try {
                        await deleteTip(t.id)
                        setStatus('Tip deleted.')
                      } catch (e) {
                        setError(messageOf(e))
                      }
                      await reload()
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <SafetyMenu profileId={t.author_id} name={t.author} onBlocked={(m) => reload().then(() => setStatus(m))} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TipForm({ city, onSave, onCancel }: { city: string; onSave: (t: NewTip) => Promise<void>; onCancel: () => void }) {
  const [tip, setTip] = useState<NewTip>({ category: null, place: '', body: '', rating: null })
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problem = tried ? checkTip(tip) : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (checkTip(tip)) return
    setBusy(true)
    setError(null)
    try {
      await onSave(tip)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card form-card review-form" onSubmit={submit} noValidate aria-label={`Share a tip about ${city}`}>
      <ChipChoice name="tip-category" legend="What kind of tip?" options={TIP_CATEGORIES} selected={tip.category ? [tip.category] : []} onChange={(v) => setTip({ ...tip, category: v[0] ?? null })} />
      <label htmlFor="tip-place" className="review-label">
        The place
      </label>
      <input
        id="tip-place"
        className="input"
        maxLength={rules.tips.placeMax}
        placeholder="e.g. Time Out Market, Cais do Sodré"
        value={tip.place}
        onChange={(e) => setTip({ ...tip, place: e.target.value })}
      />
      <label htmlFor="tip-body" className="review-label">
        Why it’s worth knowing (optional)
      </label>
      <textarea
        id="tip-body"
        className="textarea textarea-short"
        maxLength={rules.tips.textMax}
        placeholder="What did you love? Best time to go?"
        value={tip.body}
        onChange={(e) => setTip({ ...tip, body: e.target.value })}
      />
      <fieldset className="star-picker">
        <legend>Your rating (optional)</legend>
        <div className="star-picker-row">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={tip.rating && n <= tip.rating ? 'star is-on' : 'star'}>
              <input type="radio" name="tip-rating" value={n} checked={tip.rating === n} onChange={() => setTip({ ...tip, rating: n })} className="visually-hidden" />
              <span aria-hidden="true">★</span>
              <span className="visually-hidden">
                {n} {n === 1 ? 'star' : 'stars'}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <FieldError id="tip-error" error={problem} />
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="review-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Sharing…' : 'Share tip'}
        </button>
        <button type="button" className="btn-link" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
