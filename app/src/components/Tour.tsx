import { useEffect, useRef, useState } from 'react'

const STEPS: { icon: string; title: string; text: string }[] = [
  {
    icon: '✦',
    title: 'Meet people one at a time',
    text: 'Each card is someone we think you’d get on with, with the reasons why. Tap Connect to say hello, or Not now to see the next person.',
  },
  {
    icon: '↻',
    title: 'Flip the card',
    text: 'Tap a card, or the small turn-over mark in its top corner, to see the back: three questions they chose to answer. Once you’re connected, tap their name to see their full profile.',
  },
  {
    icon: '✈',
    title: 'Going when you are',
    text: 'Add a trip and anyone going to the same place at the same time appears in the burgundy strip at the top of Connections.',
  },
  {
    icon: '✓',
    title: 'Plan together',
    text: 'Once someone accepts your request, you can chat. Each chat has a plan board for ideas, with our own picks for popular cities.',
  },
  {
    icon: '♡',
    title: 'Meet up safely',
    text: 'Before you meet, “Tell someone you trust” sends a friend the details. You can block or report anyone from their card or the chat menu.',
  },
]

/** A short tour of the app, shown after sign-up and from Profile. */
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
