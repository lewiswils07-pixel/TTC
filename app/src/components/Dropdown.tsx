import { useEffect, useId, useRef, useState } from 'react'

export type DropdownOption = { value: string; label: string; disabled?: boolean; note?: string }
export type DropdownGroup = { label?: string; options: DropdownOption[] }

type Props = {
  id?: string
  /** What the field is, read out with the chosen value ("Month May"). Leave
   *  it out when a <label htmlFor={id}> already names the field. */
  label?: string
  value: string
  placeholder: string
  groups: DropdownGroup[]
  onChange: (value: string) => void
  /** Called when the list closes, for "check once they've finished". */
  onClose?: () => void
  /** Options in a grid with this many columns, for short choices like days. */
  columns?: number
  describedBy?: string
  invalid?: boolean
}

/** Our own dropdown (Lewis, 6–7 Oct: not the phone's built-in list). A button
 *  that opens the choices in a panel under it. Used for every list in the app. */
export function Dropdown({ id: given, label, value, placeholder, groups, onChange, onClose, columns, describedBy, invalid }: Props) {
  const auto = useId()
  const id = given ?? auto
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = `${id}-panel`
  const labelId = `${id}-label`
  const chosen = groups.flatMap((g) => g.options).find((o) => o.value === value)
  const closed = useRef(onClose)
  useEffect(() => {
    closed.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const close = () => {
      setOpen(false)
      closed.current?.()
    }
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close()
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      button.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    // Start on the chosen option, or the first one.
    const start = box.current?.querySelector<HTMLButtonElement>('.dropdown-option[aria-pressed="true"]') ?? box.current?.querySelector<HTMLButtonElement>('.dropdown-option:not(:disabled)')
    start?.focus()
    start?.scrollIntoView?.({ block: 'nearest' })
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    button.current?.focus()
    closed.current?.()
  }

  return (
    <div className="dropdown" ref={box}>
      {label && (
        <span id={labelId} className="visually-hidden">
          {label}
        </span>
      )}
      <button
        id={id}
        ref={button}
        type="button"
        className={chosen ? 'input dropdown-button' : 'input dropdown-button is-empty'}
        aria-labelledby={label ? `${labelId} ${id}-value` : undefined}
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span id={`${id}-value`}>{chosen ? chosen.label : placeholder}</span>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="dropdown-panel" id={panelId}>
          {groups.map((g, gi) => (
            <div className="dropdown-group" key={g.label ?? gi} role={g.label ? 'group' : undefined} aria-label={g.label}>
              {g.label && (
                <p className="dropdown-group-title" aria-hidden="true">
                  {g.label}
                </p>
              )}
              <div className={columns ? 'dropdown-grid' : undefined} style={columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}>
                {g.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className="dropdown-option"
                    aria-pressed={o.value === value}
                    disabled={o.disabled}
                    onClick={() => choose(o.value)}
                  >
                    {o.label}
                    {o.note && <span className="dropdown-note"> · {o.note}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
