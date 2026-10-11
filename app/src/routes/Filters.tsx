import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { FilterFields } from '../components/FilterFields'
import { SaveError } from '../components/Form'
import { Layout, Loading } from '../components/Layout'
import { messageOf } from '../lib/errors'
import { filterErrors, getFilters, saveFilters, type Filters as FilterValues } from '../lib/filters'
import { MAX_PREF_AGE } from '../lib/options'
import { hasPlus } from '../lib/plan'
import { useSession } from '../lib/session-context'
import { useMyProfile } from '../lib/useMyProfile'

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
  const home = useMyProfile(userId).data?.profile.home_city_id ?? null

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

  const errors = filterErrors(values)

  async function save() {
    if (!values || errors.genders || errors.ages) return
    setBusy(true)
    setError(null)
    try {
      // ID checks don’t exist yet; planning isn't asked any more (holiday preferences replaced it).
      await saveFilters(userId, { ...values, verified_only: false, styles: [] })
      navigate('/connections')
    } catch (e) {
      setError(messageOf(e))
      setBusy(false)
    }
  }

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
        <div className="card form-card">
          <FilterFields value={values} onChange={setValues} plus={plus} homeCityId={home} />
        </div>

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
