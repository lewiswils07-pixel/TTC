import { useId } from 'react'
import type { Option } from '../lib/options'
import { FieldError } from './Field'

type Props<T extends string> = {
  name: string
  legend: string
  hint?: string
  options: readonly Option<T>[]
  selected: readonly T[]
  onChange: (next: T[]) => void
  multiple?: boolean
  error?: string | null
  /** Show the chosen option's description under the control. */
  describeSelection?: boolean
  className?: string
}

/** Equal-width tiles in one row: radio buttons, or checkboxes when `multiple`. */
export function Segmented<T extends string>({ name, legend, hint, options, selected, onChange, multiple = false, error, describeSelection, className }: Props<T>) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = `${id}-error`
  const chosen = describeSelection ? options.find((o) => o.value === selected[0]) : undefined
  return (
    <fieldset className={`field${className ? ` ${className}` : ''}`} data-field={name} aria-describedby={[hintId, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}>
      <legend>{legend}</legend>
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      <div className="segmented" style={{ ['--cols' as string]: Math.min(options.length, 4) }} data-cols={Math.min(options.length, 4)} data-invalid={error ? 'true' : undefined}>
        {options.map((option) => {
          const checked = selected.includes(option.value)
          return (
            <label className="segment" key={option.value}>
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => {
                  if (!multiple) return onChange([option.value])
                  onChange(checked ? selected.filter((v) => v !== option.value) : [...selected, option.value])
                }}
              />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
      {chosen?.hint && <p className="hint selection-hint">{chosen.hint}</p>}
      <FieldError id={errorId} error={error} />
    </fieldset>
  )
}
