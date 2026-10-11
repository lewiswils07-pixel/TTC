import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { brand } from '../lib/brand'
import type { MemberExtras } from '../lib/member'
import { HOLIDAY_QUESTIONS, PERSONAL_FIELDS, type HolidayPrefs } from '../lib/options'
import { usePhotoUrl } from '../lib/photo'

/** Holiday preferences as small labelled chips, like Tinder's lifestyle row. */
export function HolidayChips({ prefs }: { prefs: HolidayPrefs }) {
  const answered = HOLIDAY_QUESTIONS.flatMap((q) => {
    const answer = q.options.find((o) => o.value === prefs[q.key])
    return answer ? [{ key: q.key, label: q.label, answer: answer.label }] : []
  })
  if (!answered.length) return null
  return (
    <ul className="chip-list holiday-chips">
      {answered.map((a) => (
        <li key={a.key} className="tag tag-pref">
          <span>{a.label}</span> {a.answer}
        </li>
      ))}
    </ul>
  )
}

/** Holiday preferences, photo book and anything personal they chose to show. */
export function ProfileExtras({ extras, name, headingLevel = 4 }: { extras: MemberExtras | null; name: string; headingLevel?: 3 | 4 }) {
  if (!extras) return null
  const H = `h${headingLevel}` as 'h3' | 'h4'
  const personal = PERSONAL_FIELDS.flatMap((f) => {
    const label = f.options.find((o) => o.value === extras[f.key])?.label
    return label ? [{ key: f.key, label }] : []
  })
  return (
    <>
      {extras.photo_book.length > 0 && (
        <div className="shared-interests">
          <H>Photo book</H>
          <PhotoBookStrip paths={extras.photo_book} name={name} />
        </div>
      )}
      {extras.holiday_prefs && Object.keys(extras.holiday_prefs).length > 0 && (
        <div className="shared-interests">
          <H>Holiday preferences</H>
          <HolidayChips prefs={extras.holiday_prefs} />
        </div>
      )}
      {extras.holiday_locked && (
        <Link className="plus-teaser" to="/profile?tab=plus">
          <span className="tag tag-plus">{brand.plusName}</span> See how {name} likes to holiday
        </Link>
      )}
      {personal.length > 0 && (
        <ul className="chip-list personal-tags" aria-label={`More about ${name}`}>
          {personal.map((p) => (
            <li key={p.key} className="tag">
              {p.label}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** A row of photo book pictures; tap one to see it large. */
export function PhotoBookStrip({ paths, name }: { paths: string[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <ul className="photo-book-strip">
        {paths.map((path, i) => (
          <li key={path}>
            <button type="button" onClick={() => setOpen(i)} aria-label={`Open ${name}’s photo ${i + 1} of ${paths.length}`}>
              <BookPhoto path={path} />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <PhotoViewer paths={paths} start={open} name={name} onClose={() => setOpen(null)} />}
    </>
  )
}

function BookPhoto({ path }: { path: string }) {
  const src = usePhotoUrl(path)
  return src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span className="skeleton" aria-hidden="true" />
}

function PhotoViewer({ paths, start, name, onClose }: { paths: string[]; start: number; name: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [i, setI] = useState(start)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    const before = document.activeElement as HTMLElement | null
    if (typeof d.showModal === 'function') d.showModal()
    else d.setAttribute('open', '')
    return () => before?.focus?.()
  }, [])
  return (
    <dialog
      ref={ref}
      className="photo-viewer"
      aria-label={`${name}’s photo book`}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // Inside a card, a tap here mustn't also turn the card over.
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <BookPhoto path={paths[i]} />
      <p className="photo-viewer-count" aria-live="polite">
        {i + 1} of {paths.length}
      </p>
      <div className="photo-viewer-actions">
        <button type="button" className="btn btn-secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
          Previous
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn-secondary" disabled={i === paths.length - 1} onClick={() => setI(i + 1)}>
          Next
        </button>
      </div>
    </dialog>
  )
}
