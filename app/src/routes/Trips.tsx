import { useEffect, useRef } from 'react'
import { Layout } from '../components/Layout'
import { MyTrips, Wishlist } from '../components/MyTrips'

/** The Trips tab. Trips are optional: they add "Also going to…" people to the Connections tab. */
export function Trips() {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])

  return (
    <Layout tab="trips">
      <h1 ref={heading} tabIndex={-1}>
        Trips
      </h1>
      <p className="lede">Optional. Add where you’re going and we’ll show you people going too, marked “Also going to…” on your Connections tab.</p>
      <MyTrips />
      <Wishlist />
    </Layout>
  )
}
