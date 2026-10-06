import { useEffect, useId, useRef } from 'react'

export type Ask = {
  title: string
  message?: string
  /** The button that goes ahead, e.g. "Delete trip". */
  confirmLabel: string
  cancelLabel?: string
  /** Shows the go-ahead button in the warning style. */
  danger?: boolean
}

/** The app's own “Are you sure?” box, in place of the browser's pop-up. */
export function ConfirmDialog({ ask, onClose }: { ask: Ask; onClose: (yes: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const title = useId()
  const body = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    // Remember where the member was, so focus goes back there afterwards.
    const before = document.activeElement as HTMLElement | null
    if (typeof d.showModal === 'function') d.showModal()
    else d.setAttribute('open', '')
    return () => before?.focus?.()
  }, [])

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby={title}
      aria-describedby={ask.message ? body : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onClose(false)
      }}
      onClick={(e) => {
        // A tap on the dimmed background outside the box counts as Cancel.
        if (e.target === e.currentTarget) onClose(false)
      }}
    >
      <div className="confirm-box">
        <h2 id={title} className="confirm-title">
          {ask.title}
        </h2>
        {ask.message && (
          <p id={body} className="confirm-text">
            {ask.message}
          </p>
        )}
        <div className="confirm-actions">
          <button type="button" className="btn btn-secondary" autoFocus onClick={() => onClose(false)}>
            {ask.cancelLabel ?? 'Cancel'}
          </button>
          <button type="button" className={ask.danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => onClose(true)}>
            {ask.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
