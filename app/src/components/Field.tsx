import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

type FieldProps = {
  name: string
  label: string
  hint?: ReactNode
  error?: string | null
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

/** Label, hint, the control, and an error that appears right under it. */
export function Field({ name, label, hint, error, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = `${id}-error`
  const describedBy = [hintId, error ? errorId : undefined].filter(Boolean).join(' ') || undefined
  return (
    <div className="field" data-field={name} data-invalid={error ? 'true' : undefined}>
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      {children({ id, describedBy, invalid: !!error })}
      <FieldError id={errorId} error={error} />
    </div>
  )
}

export function FieldError({ id, error }: { id?: string; error?: string | null }) {
  return (
    <p className="field-error" id={id} aria-live="polite">
      {error && (
        <>
          <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18">
            <circle cx="10" cy="10" r="9" fill="currentColor" />
            <rect x="9" y="5" width="2" height="6.5" rx="1" fill="var(--card)" />
            <circle cx="10" cy="14.5" r="1.25" fill="var(--card)" />
          </svg>
          <span>{error}</span>
        </>
      )}
    </p>
  )
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name'> & {
  name: string
  label: string
  hint?: ReactNode
  error?: string | null
  valid?: boolean
}

export function TextField({ name, label, hint, error, valid, className = 'input', ...input }: TextFieldProps) {
  return (
    <Field name={name} label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="input-wrap" data-valid={valid && !invalid ? 'true' : undefined}>
          <input id={id} name={name} className={className} aria-invalid={invalid || undefined} aria-describedby={describedBy} {...input} />
        </div>
      )}
    </Field>
  )
}
