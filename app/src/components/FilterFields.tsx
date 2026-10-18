import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Lock } from 'lucide-react'
import { AgeRange } from './AgeRange'
import { ChipChoice } from './ChipChoice'
import { DistanceSlider } from './DistanceSlider'
import { FieldError } from './Field'
import { InterestedIn } from './InterestedIn'
import { brand } from '../lib/brand'
import { idCheckLive } from '../lib/idCheck'
import { filterErrors, interestedInText, type Filters, type PlusFilter } from '../lib/filters'
import { HOLIDAY_QUESTIONS, MAX_PREF_AGE, MIN_AGE, STYLE_QUESTIONS, distanceLabel } from '../lib/options'

const ageText = (min: number, max: number) => `${min} to ${max >= MAX_PREF_AGE ? `${MAX_PREF_AGE}+` : max}`
/** Every filter on one sheet (Claude Design, 16 Oct): the basics with their controls in view,
 *  then how they travel and holiday preferences as chips in a gold Sodalis+ card. */
export function FilterFields({ value: f, onChange, plus }: { value: Filters; onChange: (next: Filters) => void; plus: boolean }) {
  const set = (change: Partial<Filters>) => onChange({ ...f, ...change })
  const errors = filterErrors(f)
  const [idLive, setIdLive] = useState(false)
  useEffect(() => {
    idCheckLive().then(setIdLive)
  }, [])
  const plusChips = (key: PlusFilter, label: string, options: readonly { value: string; label: string }[]) => (
    <ChipChoice key={key} name={key} legend={label} options={options} selected={f[key]} onChange={(chosen) => set({ [key]: chosen })} multiple />
  )
  return (
    <div className="filter-sheet">
      <FilterSection label="Ages" summary={ageText(f.age_min, f.age_max)}>
        <AgeRange legend="Ages" min={MIN_AGE} max={MAX_PREF_AGE} value={[f.age_min, f.age_max]} onChange={([age_min, age_max]) => set({ age_min, age_max })} />
        <FieldError error={errors.ages} />
        <Flexible label="Show people a little outside this range" checked={f.age_flexible} onChange={(age_flexible) => set({ age_flexible })} />
      </FilterSection>
      <FilterSection label="Show me" summary={interestedInText(f.genders)}>
        <InterestedIn legend="I’d like to travel with" value={f.genders} onChange={(genders) => set({ genders })} error={errors.genders} />
      </FilterSection>
      <FilterSection label="Lives within" summary={distanceLabel(f.max_distance_km)}>
        <DistanceSlider km={f.max_distance_km} onChange={(max_distance_km) => set({ max_distance_km })} />
        {f.max_distance_km !== null && <Flexible label="Show people a bit further away too" checked={f.distance_flexible} onChange={(distance_flexible) => set({ distance_flexible })} />}
        <p className="hint">Members on your trips are shown wherever they live.</p>
      </FilterSection>
      <section className={plus ? 'filter-plus' : 'filter-plus is-locked'} aria-label={`Travel style, with ${brand.plusName}`}>
        <PlusHead title="Travel style" plus={plus} />
        {idLive && <Flexible label="Only members whose ID is checked" checked={f.verified_only} onChange={(verified_only) => set({ verified_only })} />}
        {STYLE_QUESTIONS.map((q) => plusChips(q.filter, q.label, q.options))}
        <h3 className="filter-plus-sub">Holiday preferences</h3>
        {HOLIDAY_QUESTIONS.map((q) => plusChips(q.filter, q.label, q.options))}
        {!plus && (
          <>
            <p className="hint">You can set these now. They start working when you have {brand.plusName}.</p>
            <Link className="btn btn-dark btn-block" to="/profile?tab=plus">
              Unlock with {brand.plusName}
            </Link>
          </>
        )}
      </section>
    </div>
  )
}

function PlusHead({ title, plus }: { title: string; plus: boolean }) {
  return (
    <div className="filter-plus-head">
      <h3>{title}</h3>
      <span className="tag tag-plus-dark">
        {!plus && <Lock size={14} strokeWidth={2.2} aria-hidden="true" />}
        {brand.plusName}
      </span>
    </div>
  )
}

function FilterSection({ label, summary, children }: { label: string; summary: string; children: ReactNode }) {
  return (
    <section className="filter-section">
      <div className="filter-section-head">
        <h3>{label}</h3>
        <span>{summary}</span>
      </div>
      {children}
    </section>
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
