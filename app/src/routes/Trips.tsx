import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { CalendarDays, UsersRound } from 'lucide-react'
import { Layout } from '../components/Layout'
import { AddIcon, NextIcon } from '../components/Icons'
import { MyTrips, Wishlist } from '../components/MyTrips'
import { PlanInspiration } from '../components/PlanInspiration'
import { PopularPlaces } from '../components/PopularPlaces'

/** The Trips tab (Claude Design, 15 Oct). Trips are optional: they add "Also going to…" people to Who's going. */
export function Trips() {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])

  return (
    <Layout tab="trips">
      <div className="trips-top">
        <h1 ref={heading} tabIndex={-1}>
          Your trips
        </h1>
        <Link className="btn btn-primary btn-small" to="/trips/new">
          <AddIcon />
          Add a trip
        </Link>
      </div>
      <MyTrips />
      <Link className="card trips-row" to="/groups">
        <span className="trips-row-icon" aria-hidden="true">
          <UsersRound size={24} strokeWidth={1.8} />
        </span>
        <span className="trips-row-text">
          <strong>Travel as a group</strong>
          <span>Join or start a small group for one of your trips</span>
        </span>
        <NextIcon />
      </Link>
      <Link className="card trips-row" to="/connections/same-time">
        <span className="trips-row-icon" aria-hidden="true">
          <CalendarDays size={22} strokeWidth={1.8} />
        </span>
        <span className="trips-row-text">
          <strong>Going when you are</strong>
          <span>See the exact days you overlap</span>
        </span>
        <NextIcon />
      </Link>
      <PopularPlaces />
      <Wishlist />
      <PlanInspiration />
    </Layout>
  )
}
