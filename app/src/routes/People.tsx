import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { MyTrips } from '../components/MyTrips'
import { Segmented } from '../components/Segmented'
import { RequestsHint, SuggestionCard, useRequests, type Requests } from '../components/Suggestions'
import { messageOf } from '../lib/errors'
import { interestReasons, suggestByInterests, type InterestSuggestion } from '../lib/matching'

const MODES = [
  { value: 'trip', label: 'Same destination' },
  { value: 'new', label: 'Similar interests' },
] as const
type Mode = (typeof MODES)[number]['value']

/** Find people: by a trip you've booked, or by shared interests for a trip you haven't planned yet. */
export function People() {
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('mode') === 'new' ? 'new' : 'trip'
  const requests = useRequests()
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <Layout>
      <Link className="back-link" to="/dashboard">
        ‹ My profile
      </Link>
      <div className="page-head">
        <h1 ref={heading} tabIndex={-1}>
          Find people
        </h1>
        <Link className="btn btn-secondary btn-small" to="/filters">
          Filters
        </Link>
      </div>
      <Segmented
        name="mode"
        legend="Show people"
        className="mode-switch"
        options={MODES}
        selected={[mode]}
        onChange={([next]) => setParams(next === 'new' ? { mode: 'new' } : {}, { replace: true })}
      />
      {mode === 'trip' ? (
        <>
          <p className="hint section-hint">Open a trip to see who’s going to the same place at the same time.</p>
          <MyTrips />
        </>
      ) : requests ? (
        <ByInterests requests={requests} />
      ) : (
        <Loading />
      )}
    </Layout>
  )
}

function ByInterests({ requests }: { requests: Requests }) {
  const [people, setPeople] = useState<InterestSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    suggestByInterests().then(setPeople, (e) => setError(messageOf(e)))
  }, [])

  if (error) {
    return (
      <p className="notice notice-error" role="alert">
        {error}
      </p>
    )
  }
  if (!people) return <p className="hint">Finding people who share your interests…</p>

  return (
    <section aria-labelledby="by-interests">
      <h2 id="by-interests" className="section-title">
        {people.length ? `${people.length} ${people.length === 1 ? 'person' : 'people'} who share your interests` : 'People who share your interests'}
      </h2>
      {people.length === 0 ? (
        <div className="card empty">
          <p>No one matches yet. We look for members who share 2 or more of your interests and fit your filters, and more join every week.</p>
          <p className="hint">
            Adding interests, places you’d love to go, or a wider distance in <Link to="/filters">Filters</Link> can help.
          </p>
        </div>
      ) : (
        <>
          <RequestsHint requests={requests} />
          <ul className="match-list">
            {people.map((person) => (
              <SuggestionCard key={person.profile_id} person={person} reasons={interestReasons(person)} requests={requests} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
