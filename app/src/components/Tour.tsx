import { useEffect, useRef, useState } from 'react'

const STEPS: { icon: string; title: string; text: string }[] = [
  {
    icon: '✦',
    title: 'See who’s going',
    text: 'Your trips are at the top, with who’s going. Below, people show one at a time with what you share. Tap Connect, or Not now to see the next person.',
  },
  {
    icon: '↻',
    title: 'Read more about someone',
    text: 'Tap Read more to open someone’s card: their trips, how they holiday and three questions they chose to answer. Once you’re connected, you can see their full profile.',
  },
  {
    icon: '✈',
    title: 'Travel groups',
    text: 'Start a travel group for a trip from Who’s going and invite your connections.',
  },
  {
    icon: '✓',
    title: 'Plan together',
    text: 'Once someone accepts your request, you can chat. Travel groups have a plan board for ideas, with our own picks for popular cities.',
  },
  {
    icon: '♡',
    title: 'Meet up safely',
    text: 'Before you meet, “Share where you’re meeting” in the chat menu sends a friend the details. You can block or report anyone from their card or the chat menu.',
  },
]

/** A short tour of the app, from Profile and Settings. After sign-up, the first-day guide on Who’s going does this job. */
export function Tour({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [i, setI] = useState(0)
  const step = STEPS[i]
  const last = i === STEPS.length - 1

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
      className="confirm tour"
      aria-labelledby="tour-title"
      aria-describedby="tour-text"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="confirm-box tour-box">
        <p className="tour-count">
          {i + 1} of {STEPS.length}
        </p>
        <span className="tour-icon" aria-hidden="true">
          {step.icon}
        </span>
        <h2 id="tour-title" className="confirm-title" aria-live="polite">
          {step.title}
        </h2>
        <p id="tour-text" className="confirm-text">
          {step.text}
        </p>
        <div className="tour-dots" aria-hidden="true">
          {STEPS.map((s, n) => (
            <span key={s.title} className={n === i ? 'is-on' : undefined} />
          ))}
        </div>
        <div className="confirm-actions">
          {i === 0 ? (
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Skip
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          <button type="button" className="btn btn-primary" autoFocus onClick={() => (last ? onClose() : setI(i + 1))}>
            {last ? 'Start' : 'Next'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
