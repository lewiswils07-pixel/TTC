import type { Option } from '../lib/options'

type Props<T extends string> = {
  name: string
  legend: string
  options: readonly Option<T>[]
  selected: readonly T[]
  onChange: (next: T[]) => void
  /** Several answers, rather than one. */
  multiple?: boolean
  hint?: string
}

/** Light, compact chips that wrap (Lewis: no clunky boxes). One answer by
 *  default, and tapping the chosen chip again clears it. */
export function ChipChoice<T extends string>({ name, legend, options, selected, onChange, multiple = false, hint }: Props<T>) {
  return (
    <fieldset className="field chip-choice" data-field={name}>
      <legend>{legend}</legend>
      {hint && <p className="hint">{hint}</p>}
      <div className="chips chips-compact chips-light">
        {options.map((o) => {
          const checked = selected.includes(o.value)
          return (
            <label className="chip" key={o.value}>
              <input
                type="checkbox"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(checked ? selected.filter((v) => v !== o.value) : multiple ? [...selected, o.value] : [o.value])}
              />
              <span>{o.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
