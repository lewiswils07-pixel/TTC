import { useId } from 'react'

type Props = {
  legend: string
  min: number
  max: number
  value: readonly [number, number]
  onChange: (next: [number, number]) => void
}

const label = (age: number, top: number) => (age >= top ? `${top}+` : String(age))

/** One track with two handles: drag either end to set the age range. */
export function AgeRange({ legend, min, max, value, onChange }: Props) {
  const id = useId()
  const [low, high] = value
  const pct = (n: number) => ((n - min) / (max - min)) * 100
  return (
    <fieldset className="field" data-field="ages">
      <legend id={`${id}-legend`}>{legend}</legend>
      <p className="range-readout" aria-hidden="true">
        <strong>{label(low, max)}</strong> to <strong>{label(high, max)}</strong>
      </p>
      <div className="range" style={{ ['--from' as string]: `${pct(low)}%`, ['--to' as string]: `${pct(high)}%` }}>
        <input
          type="range"
          min={min}
          max={max}
          value={low}
          aria-label="Youngest age"
          aria-valuetext={`${label(low, max)} years`}
          onChange={(e) => onChange([Math.min(Number(e.target.value), high), high])}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={high}
          aria-label="Oldest age"
          aria-valuetext={`${label(high, max)} years`}
          onChange={(e) => onChange([low, Math.max(Number(e.target.value), low)])}
        />
      </div>
      <div className="range-scale" aria-hidden="true">
        <span>{min}</span>
        <span>{max}+</span>
      </div>
    </fieldset>
  )
}
