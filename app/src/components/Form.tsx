import type { ReactNode } from 'react'

/** Sticky bar at the bottom of a form: an optional note, Back, and the main button. */
export function ActionBar({ busy, onBack, label = 'Continue', note }: { busy: boolean; onBack?: () => void; label?: string; note?: ReactNode }) {
  return (
    <div className="action-bar">
      {note && <p className="action-note">{note}</p>}
      <div className="action-row">
        {onBack && (
          <button type="button" className="btn btn-secondary" onClick={onBack} disabled={busy}>
            Back
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
