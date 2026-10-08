import type { ReactNode } from 'react'

/** Sticky bar at the bottom of a form: an optional note, Back, and the main button. */
export function ActionBar({
  busy,
  onBack,
  onSkip,
  label = 'Continue',
  note,
}: {
  busy: boolean
  onBack?: () => void
  /** "Skip for now", in the Back button's place, for an optional step. */
  onSkip?: () => void
  label?: string
  note?: ReactNode
}) {
  return (
    <div className="action-bar">
      {note && <p className="action-note">{note}</p>}
      <div className="action-row">
        {onBack && (
          <button type="button" className="btn btn-secondary" onClick={onBack} disabled={busy}>
            Back
          </button>
        )}
        {onSkip && (
          <button type="button" className="btn btn-secondary" onClick={onSkip} disabled={busy}>
            Skip for now
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : label}
        </button>
      </div>
    </div>
  )
}

export function SaveError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="notice notice-error" role="alert">
      {error}
    </p>
  )
}
