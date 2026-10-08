import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { longDate } from '../lib/dates'
import { messageOf } from '../lib/errors'
import { checkReview, cityReviews, deleteReview, MAX_REVIEW, reviewDate, saveReview, type Review } from '../lib/reviews'
import { useConfirm } from '../lib/useConfirm'
import { FieldError } from './Field'
import { SafetyBox } from './SafetyBox'

/** "★★★★☆" for a rating, read out as "4 out of 5 stars". */
export function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>
      <span aria-hidden="true">{'★'.repeat(full)}</span>
      <span className="stars-off" aria-hidden="true">
        {'★'.repeat(5 - full)}
      </span>
    </span>
  )
}

/** Members' star ratings and reviews of a place, and your own. `opensOn` is the day your trip starts,
 *  when that's still to come: reviews are for people who've been. */
export function CityReviews({ cityId, city, opensOn }: { cityId: number; city: string; opensOn?: string }) {
  const { ask, dialog } = useConfirm()
  const [reviews, setReviews] = useState<Review[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const reload = useCallback(() => cityReviews(cityId).then(setReviews), [cityId])
  useEffect(() => {
    reload().catch((e) => setError(messageOf(e)))
  }, [reload])

  if (!reviews) return error ? <p className="notice notice-error">{error}</p> : <div className="skeleton-block" aria-hidden="true" />

  const mine = reviews.find((r) => r.mine)
  const others = reviews.filter((r) => !r.mine)
  const summary = reviews[0]

  return (
    <div className="city-reviews">
      {dialog}
      <p className="visually-hidden" role="status">
        {status}
      </p>
      {summary ? (
        <p className="review-summary">
          <strong className="review-average">{summary.average.toFixed(1)}</strong>
          <Stars rating={summary.average} />
          <span className="hint">
            {summary.total} {summary.total === 1 ? 'review' : 'reviews'}
          </span>
        </p>
      ) : (
        <p className="hint section-hint">No reviews of {city} yet.{opensOn ? '' : ' Yours could be the first.'}</p>
      )}

      {mine && !editing ? (
        <div className="card review is-mine">
          <p className="review-head">
            <strong>Your review</strong>
            <Stars rating={mine.rating} />
          </p>
          {mine.body && <p className="review-body">{mine.body}</p>}
          <div className="review-actions">
            <button type="button" className="btn-link" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              type="button"
              className="btn-link btn-danger-link"
              onClick={async () => {
                if (!(await ask({ title: `Delete your review of ${city}?`, confirmLabel: 'Delete', danger: true }))) return
                setError(null)
                try {
                  await deleteReview(cityId)
                  setStatus('Review deleted.')
                } catch (e) {
                  setError(messageOf(e))
                }
                await reload()
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : opensOn && !mine ? (
        <p className="card review-later">
          You can add your own review once your trip starts, on {longDate(opensOn)}.
        </p>
      ) : (
        <ReviewForm
          city={city}
          initial={mine}
          onCancel={mine ? () => setEditing(false) : undefined}
          onSave={async (rating, body) => {
            await saveReview(cityId, rating, body)
            setEditing(false)
            setStatus('Thanks, your review is saved.')
            await reload()
          }}
        />
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {others.length > 0 && (
        <ul className="review-list">
          {others.map((r) => (
            <li key={r.author_id} className="card review">
              <p className="review-head">
                <strong>{r.author}</strong>
                <Stars rating={r.rating} />
              </p>
              <p className="review-meta">
                {r.went_on_trip && <span className="tag tag-muted">Been on a trip here</span>}
                <span className="hint">{reviewDate(r.updated_at)}</span>
              </p>
              {r.body && <p className="review-body">{r.body}</p>}
              <SafetyBox profileId={r.author_id} name={r.author} onBlocked={(m) => reload().then(() => setStatus(m))} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReviewForm({ city, initial, onSave, onCancel }: { city: string; initial?: Review; onSave: (rating: number, body: string) => Promise<void>; onCancel?: () => void }) {
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null)
  const [body, setBody] = useState(initial?.body ?? '')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problem = tried ? checkReview(rating, body) : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (checkReview(rating, body)) return
    setBusy(true)
    setError(null)
    try {
      await onSave(rating!, body)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card form-card review-form" onSubmit={submit} noValidate aria-label={`Review ${city}`}>
      <fieldset className="star-picker" aria-describedby={problem ? 'review-error' : undefined}>
        <legend>How was {city}?</legend>
        <div className="star-picker-row">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={rating && n <= rating ? 'star is-on' : 'star'}>
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="visually-hidden" />
              <span aria-hidden="true">★</span>
              <span className="visually-hidden">
                {n} {n === 1 ? 'star' : 'stars'}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="review-body" className="review-label">
        A few words (optional)
      </label>
      <textarea
        id="review-body"
        className="textarea textarea-short"
        maxLength={MAX_REVIEW}
        placeholder="What did you love? Any tips for members?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <FieldError id="review-error" error={problem} />
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="review-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Post review'}
        </button>
        {onCancel && (
          <button type="button" className="btn-link" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
