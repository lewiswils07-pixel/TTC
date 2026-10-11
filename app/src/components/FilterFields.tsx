import { useId, useState, type ReactNode } from 'react'
import { AgeRange } from './AgeRange'
import { ChipChoice } from './ChipChoice'
import { DistanceSlider } from './DistanceSlider'
import { FieldError } from './Field'
import { HomeMap } from './HomeMap'
import { useHomeSpot } from '../lib/cities'
import { InterestedIn } from './InterestedIn'
import { brand } from '../lib/brand'
import { filterErrors, interestedInText, type Filters } from '../lib/filters'
import { BUDGETS, DISTANCE_MILES, MAX_PREF_AGE, MIN_AGE, PACES, distanceLabel, distanceStop } from '../lib/options'

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
export function FilterFields({ value: f, onChange, plus, homeCityId }: { value: Filters; onChange: (next: Filters) => void; plus: boolean; homeCityId: number | null }) {
  const [open, setOpen] = useState<string | null>(null)
  const set = (change: Partial<Filters>) => onChange({ ...f, ...change })
  const errors = filterErrors(f)
  const spot = useHomeSpot(homeCityId)
  const row = (key: string, label: string, summary: string, body: ReactNode, error?: string | null) => (
    <FilterRow key={key} label={label} summary={summary} open={open === key || !!error} onToggle={() => setOpen(open === key ? null : key)}>
      {body}
    </FilterRow>
  )
  return (
    <div className="filter-rows">
      <h3 className="filter-group">Member preferences</h3>
      {row(
        'genders',
        'I’m interested in',
        interestedInText(f.genders),
        <InterestedIn legend="I’m interested in" value={f.genders} onChange={(genders) => set({ genders })} error={errors.genders} />,
        errors.genders,
      )}
      {row(
        'ages',
        'Age range',
        ageText(f.age_min, f.age_max),
        <>
          <AgeRange legend="Age range" min={MIN_AGE} max={MAX_PREF_AGE} value={[f.age_min, f.age_max]} onChange={([age_min, age_max]) => set({ age_min, age_max })} />
          <FieldError error={errors.ages} />
        </>,
        errors.ages,
      )}
      {row(
        'distance',
        'Maximum distance',
        distanceLabel(DISTANCE_MILES[distanceStop(f.max_distance_km)]),
        <>
          <DistanceSlider km={f.max_distance_km} onChange={(max_distance_km) => set({ max_distance_km })} />
          {spot && <HomeMap spot={spot} km={f.max_distance_km} />}
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
      {row('paces', 'Pace', listText(f.paces, PACES), <ChipChoice name="paces" legend="Pace" options={PACES} selected={f.paces} onChange={(paces) => set({ paces })} multiple />)}
      {row('budgets', 'Budget', listText(f.budgets, BUDGETS), <ChipChoice name="budgets" legend="Budget" options={BUDGETS} selected={f.budgets} onChange={(budgets) => set({ budgets })} multiple />)}
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
