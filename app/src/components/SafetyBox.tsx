import { useEffect, useId, useRef, useState } from 'react'
import { messageOf } from '../lib/errors'
import { blockMember, MAX_REPORT_DETAILS, REPORT_REASONS, reportMember, type ReportReason } from '../lib/safety'
import { Field, FieldError } from './Field'

type Mode = 'closed' | 'menu' | 'block' | 'report' | 'reported'

/**
 * "Block or report" at the foot of a member's card. Blocking calls
 * onBlocked so the card can go; a report without a block stays on the card.
 */
export function SafetyBox({ profileId, name, onBlocked }: { profileId: string; name: string; onBlocked: (message: string) => void }) {
  const [mode, setMode] = useState<Mode>('closed')
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(true)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (mode !== 'closed') panel.current?.querySelector<HTMLElement>('button, input')?.focus()
  }, [mode])

  function close() {
    setMode('closed')
    setError(null)
    setTried(false)
  }

  async function run(action: () => Promise<void>, after: () => void) {
    setBusy(true)
    setError(null)
    try {
      await action()
      after()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  const block = () => run(() => blockMember(profileId), () => onBlocked(`You blocked ${name}. You won’t see each other again.`))

  function report() {
    setTried(true)
    if (!reason) return
    void run(
      async () => {
        await reportMember(profileId, reason, details)
        if (alsoBlock) await blockMember(profileId)
      },
      () => (alsoBlock ? onBlocked(`Thanks for telling us. We’ll look into it, and you won’t see ${name} again.`) : setMode('reported')),
    )
  }

  if (mode === 'reported') {
    return (
      <p className="notice notice-success" role="status">
        Thanks for telling us. We’ll look into it. {name} isn’t told who reported them.
      </p>
    )
  }
  if (mode === 'closed') {
    return (
      <button type="button" className="btn-link safety-link" onClick={() => setMode('menu')}>
        Block or report {name}
      </button>
    )
  }

  const errorRow = error && (
    <p className="notice notice-error" role="alert">
      {error}
    </p>
  )

  return (
    <div className="safety-box" ref={panel}>
      {mode === 'menu' && (
        <>
          <div className="safety-choices">
            <button type="button" className="btn btn-secondary" onClick={() => setMode('report')}>
              Report {name}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setMode('block')}>
              Block {name}
            </button>
          </div>
          <button type="button" className="btn-link safety-link" onClick={close}>
            Cancel
          </button>
        </>
      )}

      {mode === 'block' && (
        <>
          <p>
            <strong>Block {name}?</strong> You won’t see each other anywhere, and any request or connection between you ends. {name} isn’t
            told.
          </p>
          {errorRow}
          <div className="action-row">
            <button type="button" className="btn btn-secondary" onClick={close} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={block} disabled={busy}>
              {busy ? 'Blocking…' : `Block ${name}`}
            </button>
          </div>
        </>
      )}

      {mode === 'report' && (
        <>
          <fieldset className="field" aria-describedby={tried && !reason ? `${id}-reason-error` : undefined}>
            <legend>What’s wrong?</legend>
            <div className="chips chips-compact">
              {REPORT_REASONS.map((r) => (
                <label className="chip" key={r.value}>
                  <input type="radio" name={`${id}-reason`} checked={reason === r.value} onChange={() => setReason(r.value)} />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
            <FieldError id={`${id}-reason-error`} error={tried && !reason ? 'Please choose what’s wrong.' : null} />
          </fieldset>
          <Field name="details" label="Anything else we should know? (optional)" hint={`Only our team sees this. ${MAX_REPORT_DETAILS - details.length} characters left.`}>
            {({ id: fieldId, describedBy }) => (
              <textarea
                id={fieldId}
                className="textarea textarea-short"
                maxLength={MAX_REPORT_DETAILS}
                aria-describedby={describedBy}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            )}
          </Field>
          <label className="switch-row">
            <input type="checkbox" role="switch" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
            <span>
              <strong>Also block {name}</strong>
              <span className="hint">You won’t see each other again.</span>
            </span>
          </label>
          {errorRow}
          <div className="action-row">
            <button type="button" className="btn btn-secondary" onClick={close} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={report} disabled={busy}>
              {busy ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
