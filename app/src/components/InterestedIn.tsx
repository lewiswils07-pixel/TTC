import { useId } from 'react'
import { INTERESTED_IN, type Gender } from '../lib/options'
import { FieldError } from './Field'

/** "I’m interested in" as Hinge does it: one row each, plus Everyone (Lewis, 11 Oct). */
export function InterestedIn({ value, onChange, error, legend = 'I’m interested in' }: { value: readonly Gender[]; onChange: (next: Gender[]) => void; error?: string | null; legend?: string }) {
  const id = useId()
  const all = INTERESTED_IN.map((o) => o.value as Gender)
  const everyone = all.every((g) => value.includes(g))
  const rows = [...INTERESTED_IN.map((o) => ({ key: o.value as string, label: o.label, checked: !everyone && value.includes(o.value) })), { key: 'all', label: 'Everyone', checked: everyone }]
  return (
    <fieldset className="field check-rows" data-field="genders" aria-describedby={error ? `${id}-error` : undefined}>
      <legend>{legend}</legend>
      <p className="hint">Select all who you’re open to meeting.</p>
      {rows.map((r) => (
        <label className="check-row" key={r.key}>
          <span>{r.label}</span>
          <input
            type="checkbox"
            checked={r.checked}
            onChange={() => {
              if (r.key === 'all') return onChange(everyone ? [] : all)
              const g = r.key as Gender
              const base = everyone ? [] : value.filter((v) => v !== g)
              onChange(r.checked ? base : [...base, g])
            }}
          />
        </label>
      ))}
      <FieldError id={`${id}-error`} error={error} />
    </fieldset>
  )
}
