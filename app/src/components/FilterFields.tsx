import { useId, useState, type ReactNode } from 'react'
import { AgeRange } from './AgeRange'
import { ChipChoice } from './ChipChoice'
import { DistanceSlider } from './DistanceSlider'
import { FieldError } from './Field'
import { InterestedIn } from './InterestedIn'
import { brand } from '../lib/brand'
import { filterErrors, interestedInText, type Filters, type PlusFilter } from '../lib/filters'
import { HOLIDAY_QUESTIONS, MAX_PREF_AGE, MIN_AGE, STYLE_QUESTIONS, distanceLabel } from '../lib/options'

const ageText = (min: number, max: number) => `${min} to ${max >= MAX_PREF_AGE ? `${MAX_PREF_AGE}+` : max}`
const listText = (chosen: readonly string[], options: readonly { value: string; label: string }[]) =>
  chosen.length
    ? options
        .filter((o) => chosen.includes(o.value))
        .map((o) => o.label)
        .join(', ')
    : 'Open to all'

/** Every filter as a list of rows, like Hinge (Lewis, 11 Oct: the boxes were
 *  clunky). Each row shows its setting and opens to change it. */
export function FilterFields({ value: f, onChange, plus }: { value: Filters; onChange: (next: Filters) => void; plus: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const set = (change: Partial<Filters>) => onChange({ ...f, ...change })
  const errors = filterErrors(f)
  const row = (key: string, label: string, summary: string, body: ReactNode, error?: string | null) => (
    <FilterRow key={key} label={label} summary={summary} open={open === key || !!error} onToggle={() => setOpen(open === key ? null : key)}>
      {body}
    </FilterRow>
  )
  const plusRow = (key: PlusFilter, label: string, options: readonly { value: string; label: string }[]) =>
    row(key, label, listText(f[key], options), <ChipChoice name={key} legend={label} options={options} selected={f[key]} onChange={(chosen) => set({ [key]: chosen })} multiple />)
  return (
    <div className="filter-rows">
      <h3 className="filter-group">Member preferences</h3>
      {row(
        'genders',
        'I’d like to travel with',
        interestedInText(f.genders),
        <InterestedIn legend="I’d like to travel with" value={f.genders} onChange={(genders) => set({ genders })} error={errors.genders} />,
        errors.genders,
      )}
      {row(
        'ages',
        'Age range',
        ageText(f.age_min, f.age_max),
        <>
          <AgeRange legend="Age range" min={MIN_AGE} max={MAX_PREF_AGE} value={[f.age_min, f.age_max]} onChange={([age_min, age_max]) => set({ age_min, age_max })} />
          <FieldError error={errors.ages} />
          <Flexible label="Show people a little outside this range" checked={f.age_flexible} onChange={(age_flexible) => set({ age_flexible })} />
        </>,
        errors.ages,
      )}
      {row(
        'distance',
        'Maximum distance',
        distanceLabel(f.max_distance_km),
        <>
          <DistanceSlider km={f.max_distance_km} onChange={(max_distance_km) => set({ max_distance_km })} />
          {f.max_distance_km !== null && <Flexible label="Show people a bit further away too" checked={f.distance_flexible} onChange={(distance_flexible) => set({ distance_flexible })} />}
        </>,
      )}
      <div className="filter-group filter-group-plus">
        <h3>How they travel</h3>
        <span className="tag tag-plus">{brand.plusName}</span>
      </div>
      {!plus && (
        <p className="hint">
          These come with {brand.plusName}. You can set them now, and they’ll start working when you have {brand.plusName}.
        </p>
      )}
      {STYLE_QUESTIONS.map((q) => plusRow(q.filter, q.label, q.options))}
      <h3 className="filter-group">Holiday preferences</h3>
      {HOLIDAY_QUESTIONS.map((q) => plusRow(q.filter, q.label, q.options))}
    </div>
  )
}

function FilterRow({ label, summary, open, onToggle, children }: { label: string; summary: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  const id = useId()
  return (
    <div className={open ? 'filter-row is-open' : 'filter-row'}>
      <button type="button" className="filter-row-head" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className="filter-row-label">{label}</span>
        <span className="filter-row-value">{summary}</span>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="m7.5 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="filter-row-body" id={id}>
          {children}
        </div>
      )}
    </div>
  )
}

/** Hinge's "dealbreaker" switch, the other way round: ticked shows people just outside, lower down. */
function Flexible({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="check-row distance-any">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
