import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AgeRange } from '../components/AgeRange'
import { DistanceSlider } from '../components/DistanceSlider'
import { FieldError } from '../components/Field'
import { SaveError } from '../components/Form'
import { Layout, Loading } from '../components/Layout'
import { Segmented } from '../components/Segmented'
import { brand } from '../lib/brand'
import { messageOf } from '../lib/errors'
import { getFilters, saveFilters, type Filters as FilterValues } from '../lib/filters'
import { BUDGETS, MAX_PREF_AGE, MIN_AGE, PACES, SHOWN_GENDERS, TRAVEL_STYLES } from '../lib/options'
import { hasPlus } from '../lib/plan'
import { useSession } from '../lib/session-context'
import { checkAgeRange } from '../lib/validation'

/** Who to show in suggestions. The Sodalis+ filters are shown to everyone but only unlock with the plan. */
export function Filters() {
  const { session } = useSession()
  const userId = session!.user.id
  const [values, setValues] = useState<FilterValues | null>(null)
  const [plus, setPlus] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([getFilters(userId), hasPlus()]).then(
      ([f, p]) => {
        setValues({ ...f, age_max: Math.min(f.age_max, MAX_PREF_AGE) })
        setPlus(p)
      },
      (e) => setError(messageOf(e)),
    )
  }, [userId])

  const focused = useRef(false)
  useEffect(() => {
    if (values && !focused.current) {
      focused.current = true
      heading.current?.focus()
    }
  }, [values])

  if (!values) {
    return error ? (
      <Layout>
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      </Layout>
    ) : (
      <Loading />
    )
  }

  const set = (change: Partial<FilterValues>) => setValues({ ...values, ...change })
  const gendersError = values.genders.length ? null : 'Choose at least one option.'
  const agesError = checkAgeRange([values.age_min, values.age_max])

  async function save() {
    if (!values || gendersError || agesError) return
    setBusy(true)
    setError(null)
    try {
      await saveFilters(userId, { ...values, verified_only: false }) // ID checks don’t exist yet
      navigate('/connections')
    } catch (e) {
      setError(messageOf(e))
      setBusy(false)
    }
  }

  const locked = !plus
  return (
    <Layout>
      <Link className="back-link" to="/connections">
        ‹ Connect
      </Link>
      <h1 ref={heading} tabIndex={-1}>
        Filters
      </h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        noValidate
      >
        <section className="card form-card" aria-labelledby="who-heading">
          <h2 id="who-heading" className="card-title">
            Who you’d like to travel with
          </h2>
          <Segmented
            name="genders"
            legend="Show me"
            hint="Pick all that apply."
            options={SHOWN_GENDERS}
            selected={values.genders}
            onChange={(genders) => set({ genders })}
            multiple
            error={gendersError}
          />
          <AgeRange legend="Aged" min={MIN_AGE} max={MAX_PREF_AGE} value={[values.age_min, values.age_max]} onChange={([age_min, age_max]) => set({ age_min, age_max })} />
          <FieldError error={agesError} />
          <DistanceSlider km={values.max_distance_km} onChange={(max_distance_km) => set({ max_distance_km })} />
        </section>

        <section className="card form-card plus-filters" aria-labelledby="plus-heading" data-locked={locked || undefined}>
          <div className="section-head">
            <h2 id="plus-heading" className="card-title">
              More filters
            </h2>
            <span className="tag tag-plus">{brand.plusName}</span>
          </div>
          {locked && (
            <p className="hint" id="plus-locked">
              These come with {brand.plusName}. You can set them now, and they’ll start working when you have {brand.plusName}.
            </p>
          )}
          {/* “Verified members only” returns when members can check their ID with us. */}
          <Segmented name="styles" legend="Planning" hint="Leave all off to see everyone." options={TRAVEL_STYLES} selected={values.styles} onChange={(styles) => set({ styles })} multiple />
          <Segmented name="paces" legend="Pace" options={PACES} selected={values.paces} onChange={(paces) => set({ paces })} multiple />
          <Segmented name="budgets" legend="Budget" options={BUDGETS} selected={values.budgets} onChange={(budgets) => set({ budgets })} multiple />
        </section>

        <SaveError error={error} />
        <div className="action-row">
          <Link className="btn btn-secondary" to="/connections">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save filters'}
          </button>
        </div>
      </form>
    </Layout>
  )
}
