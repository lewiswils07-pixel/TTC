import type { Option } from '../lib/options'

type Props<T extends string> = {
  legend: string
  hint?: string
  options: readonly Option<T>[]
  selected: readonly T[]
  onChange: (next: T[]) => void
  multiple?: boolean
  max?: number
  name: string
}

/** A group of tappable pills, backed by real checkboxes or radio buttons. */
export function ChoiceChips<T extends string>({ legend, hint, options, selected, onChange, multiple = false, max, name }: Props<T>) {
  const atMax = max !== undefined && selected.length >= max
  const hintId = hint ? `${name}-hint` : undefined
  return (
    <fieldset className="field" aria-describedby={hintId}>
      <legend>{legend}</legend>
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      <div className="chips">
        {options.map((option) => {
          const checked = selected.includes(option.value)
          return (
            <label className="chip" key={option.value}>
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                value={option.value}
                checked={checked}
                disabled={multiple && !checked && atMax}
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
    </fieldset>
  )
}
