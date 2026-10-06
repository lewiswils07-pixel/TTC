import { useState, type InputHTMLAttributes } from 'react'
import { Field } from './Field'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'type'> & {
  name: string
  label: string
  hint?: string
  error?: string | null
}

/** A password box with a Show/Hide button, so members can check what they typed. */
export function PasswordField({ name, label, hint, error, ...input }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <Field name={name} label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="input-wrap password-wrap">
          <input
            id={id}
            name={name}
            className="input"
            type={visible ? 'text' : 'password'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            {...input}
          />
          <button type="button" className="password-toggle" aria-pressed={visible} aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible((v) => !v)}>
            {visible ? 'Hide' : 'Show'}
          </button>
        </div>
      )}
    </Field>
  )
}
