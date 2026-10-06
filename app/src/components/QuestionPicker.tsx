import { useEffect, useRef, useState } from 'react'
import { CARD_QUESTIONS, questionText } from '../lib/card'

type Props = {
  id: string
  value: string
  /** Questions already used on the other slots. */
  taken: Set<string>
  onChange: (key: string) => void
  describedBy?: string
  invalid?: boolean
}

/** Our own question chooser (Lewis, 6 Oct: not the phone's built-in list). A
 *  button that opens the questions, grouped, in a panel under it. */
export function QuestionPicker({ id, value, taken, onChange, describedBy, invalid }: Props) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = `${id}-panel`

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    // Start on the chosen question, or the first one.
    box.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"], .question-option:not(:disabled)')?.focus()
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  function choose(key: string) {
    onChange(key)
    setOpen(false)
    button.current?.focus()
  }

  return (
    <div className="question-picker" ref={box}>
      <button
        id={id}
        ref={button}
        type="button"
        className={value ? 'input question-button' : 'input question-button is-empty'}
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{value ? questionText(value) : 'Choose a question'}</span>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="question-panel" id={panelId}>
          {CARD_QUESTIONS.map((g) => (
            <div className="question-group" key={g.group} role="group" aria-label={g.group}>
              <p className="question-group-title" aria-hidden="true">
                {g.group}
              </p>
              {g.questions.map((q) => {
                const used = taken.has(q.key)
                return (
                  <button
                    key={q.key}
                    type="button"
                    className="question-option"
                    aria-pressed={q.key === value}
                    disabled={used}
                    onClick={() => choose(q.key)}
                  >
                    {q.text}
                    {used && <span className="question-used"> · already used</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
