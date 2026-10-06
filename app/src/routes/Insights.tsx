import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { Segmented } from '../components/Segmented'
import { SubNav } from '../components/SubNav'
import { iAmAdmin } from '../lib/admin'
import { messageOf } from '../lib/errors'
import { brand } from '../lib/brand'
import { HEARD_FROM, adminKpis, npsScore, pct, type Kpis } from '../lib/kpis'
import { ADMIN_NAV } from '../lib/nav'
import { GENDERS, labelFor } from '../lib/options'

const PERIODS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
] as const

/** The team's KPIs, grouped by stage of the member journey. Admins only. */
export function Insights() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [days, setDays] = useState('30')
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    iAmAdmin().then(setAllowed)
  }, [])

  useEffect(() => {
    if (!allowed) return
    adminKpis(Number(days)).then(
      (k) => {
        setKpis(k)
        setError(null)
      },
      (e) => setError(messageOf(e)),
    )
  }, [allowed, days])

  useEffect(() => {
    if (kpis) heading.current?.focus()
  }, [kpis])

  if (allowed === false) {
    return (
      <Layout>
        <h1>Insights</h1>
        <p className="lede">This page is only for the {brand.shortName} team.</p>
        <Link className="btn btn-secondary" to="/profile">
          Back to my profile
        </Link>
      </Layout>
    )
  }
  if (!kpis && !error) return <Loading />

  return (
    <Layout>
      <Link className="back-link" to="/profile">
        ‹ My profile
      </Link>
      <h1 ref={heading} tabIndex={-1}>
        Insights
      </h1>
      <SubNav label="Team" items={ADMIN_NAV} current="/admin/insights" />
      <Segmented name="period" legend="New in the last" className="mode-switch" options={PERIODS} selected={[days as '30']} onChange={([d]) => setDays(d)} />
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {kpis && <Report k={kpis} />}
    </Layout>
  )
}

function Report({ k }: { k: Kpis }) {
  const { acquisition: a, liquidity: l, matching: m, retention: r, community: c } = k
  const period = `last ${k.period_days} days`
  const responded = m.accepted + m.declined
  const nps = npsScore(c.nps_promoters, c.nps_detractors, c.nps_responses)
  const answered = m.would_travel_again + m.would_not

  return (
    <>
      <Section title="Getting members">
        <Tile value={a.members} label="Members" />
        <Tile value={a.new_members} label={`New, ${period}`} />
        <Tile value={pct(a.new_members, a.new_members + a.started_not_finished)} label="Finished sign-up" detail={`${a.started_not_finished} started but didn’t finish`} />
        <Tile value="Not live" label="Phone check" detail="Counts once the phone check is built" muted />
        <Bars title="Sign-ups per week" weeks={a.by_week} />
        <Breakdown title="Where they heard about us" counts={a.by_channel} label={(key) => (key === 'not_said' ? 'Didn’t say' : labelFor(HEARD_FROM, key as never))} />
        <Breakdown title="Age" counts={a.age_bands} />
        <Breakdown title="Gender" counts={a.genders} label={(key) => labelFor(GENDERS, key as never)} />
        <p className="hint kpi-note">Cost per member: £0 so far. Divide what you spend on ads by new members once you start spending.</p>
      </Section>

      <Section title="Enough people to match">
        <Tile value={l.members_with_trip} label="Members with a trip" detail={`${l.upcoming_trips} upcoming trips`} />
        <Tile value={pct(l.trips_with_overlap, l.upcoming_trips)} label="Trips with someone going too" />
        <Tile value={pct(l.shown_a_match, a.members)} label="Shown at least one match" />
        <Tile value={l.median_hours_to_first_match === null ? '–' : hours(l.median_hours_to_first_match)} label="Sign-up to first match" detail="Median" />
        {l.top_places.length > 0 && (
          <div className="kpi-wide">
            <h3>Busiest places and months</h3>
            <ul className="kpi-list">
              {l.top_places.map((p) => (
                <li key={`${p.city}-${p.month}`}>
                  <span>
                    {p.city}, {month(p.month)}
                  </span>
                  <strong>{p.members}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Match quality and safety">
        <Tile value={m.requests} label={`Requests, ${period}`} detail={`${m.waiting} waiting for a reply`} />
        <Tile value={pct(m.accepted, responded)} label="Accepted" detail={`${m.accepted} of ${responded} answered`} />
        <Tile value={pct(m.would_travel_again, answered)} label="Would travel together again" detail={`${m.met} said they met`} />
        <Tile value={per100(m.reports + m.blocks, m.active_members)} label="Reports and blocks per 100 active" detail={`${m.reports} reports, ${m.blocks} blocks, ${m.flagged_messages} flagged messages`} />
      </Section>

      <Section title="Coming back">
        <Tile value={r.active_7_days} label="Active this week" detail={`${r.active_today} today`} />
        <Tile value={r.active_30_days} label="Active this month" />
        <Tile value={pct(r.with_2_connections, r.with_a_connection)} label="Connected with 2 or more" detail={`${r.with_a_connection} have a connection`} />
        <Tile value={pct(r.gone_quiet, r.joined_over_30_days)} label="Gone quiet" detail="Joined 30+ days ago, not back in 30 days" />
        <Bars title="Active members per week" weeks={r.weekly_active} />
        <div className="kpi-wide">
          <h3>Profiles filled in</h3>
          <ul className="kpi-list">
            <li>
              <span>Photo</span>
              <strong>{pct(r.profile.photo, a.members)}</strong>
            </li>
            <li>
              <span>About me</span>
              <strong>{pct(r.profile.bio, a.members)}</strong>
            </li>
            <li>
              <span>How they travel</span>
              <strong>{pct(r.profile.travel_style, a.members)}</strong>
            </li>
            <li>
              <span>Added a trip</span>
              <strong>{pct(r.profile.trip, a.members)}</strong>
            </li>
          </ul>
        </div>
        {r.poor_match_members > 0 && (
          <p className="hint kpi-note">
            Of {r.poor_match_members} who wouldn’t travel with a match again, {r.quiet_after_poor_match} have gone quiet.
          </p>
        )}
      </Section>

      <Section title="Community">
        <Tile value={c.in_a_group} label="Members in a group" detail={`${c.groups} groups with upcoming dates`} />
        <Tile value={pct(c.heard_from_member, c.said_where_heard)} label="Joined through a member" />
        <Tile value={nps === null ? '–' : nps > 0 ? `+${nps}` : nps} label="Would recommend us (NPS)" detail={`${c.nps_responses} answers in 90 days`} />
        {c.nps_comments.length > 0 && (
          <div className="kpi-wide">
            <h3>What members said</h3>
            <ul className="kpi-quotes">
              {c.nps_comments.map((q) => (
                <li key={q.at}>
                  <strong>{q.score}/10</strong> “{q.comment}”
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="kpi-section" aria-label={title}>
      <h2 className="section-title gold-rule">{title}</h2>
      <div className="kpi-grid">{children}</div>
    </section>
  )
}

function Tile({ value, label, detail, muted = false }: { value: ReactNode; label: string; detail?: string; muted?: boolean }) {
  return (
    <div className={muted ? 'card kpi-tile is-muted' : 'card kpi-tile'}>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
      {detail && <span className="kpi-detail">{detail}</span>}
    </div>
  )
}

function Bars({ title, weeks }: { title: string; weeks: { week: string; count: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count))
  return (
    <div className="kpi-wide">
      <h3>{title}</h3>
      <ol className="kpi-bars">
        {weeks.map((w) => (
          <li key={w.week}>
            <span className="kpi-bar-value">{w.count}</span>
            <span className={w.count ? 'kpi-bar' : 'kpi-bar is-zero'} style={{ height: `${Math.max(2, (w.count / max) * 100)}%` }} aria-hidden="true" />
            <span className="kpi-bar-label">{shortWeek(w.week)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Breakdown({ title, counts, label = (k) => k }: { title: string; counts: Record<string, number>; label?: (key: string) => string }) {
  const rows = Object.entries(counts).sort((x, y) => y[1] - x[1])
  if (!rows.length) return null
  const total = rows.reduce((n, [, v]) => n + v, 0)
  return (
    <div className="kpi-wide">
      <h3>{title}</h3>
      <ul className="kpi-list">
        {rows.map(([key, n]) => (
          <li key={key}>
            <span>{label(key)}</span>
            <strong>
              {n} <span className="kpi-detail">({pct(n, total)})</span>
            </strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function per100(n: number, active: number): string {
  return active > 0 ? (Math.round((n / active) * 1000) / 10).toString() : '–'
}

function hours(h: number): string {
  return h < 1 ? 'Under an hour' : h < 48 ? `${Math.round(h)} hours` : `${Math.round(h / 24)} days`
}

const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
function month(ym: string): string {
  return monthFormat.format(new Date(`${ym}-01T00:00:00Z`))
}

const weekFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
function shortWeek(iso: string): string {
  return weekFormat.format(new Date(`${iso}T00:00:00Z`))
}
