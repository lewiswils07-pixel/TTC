import { useEffect, useRef } from 'react'
import { Layout } from '../components/Layout'
import { HubRow } from '../components/HubRow'
import { MyTrips, Wishlist } from '../components/MyTrips'
import { PopularPlaces } from '../components/PopularPlaces'

/** The Trips tab. Trips are optional: they add "Also going to…" people to the Connect tab. */
export function Trips() {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])

  return (
    <Layout tab="trips">
      <h1 ref={heading} tabIndex={-1}>
        Trips
      </h1>
      <p className="lede">Optional. Add where you’re going and we’ll show you members going too.</p>
      <MyTrips />
      <PopularPlaces />
      <ul className="hub-list trips-groups">
        <li>
          <HubRow to="/groups" title="Travel as a group" text="Plan a trip with up to 6 people you’re connected with" />
        </li>
      </ul>
      <Wishlist />
    </Layout>
  )
}
