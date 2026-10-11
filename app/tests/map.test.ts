import { describe, expect, it } from 'vitest'
import { metresPerPixel, project, unproject, zoomFor } from '../src/lib/map'

describe('map maths', () => {
  it('turns a place into pixels and back', () => {
    const london = { lat: 51.5072, lng: -0.1276 }
    const { x, y } = project(london, 12)
    const back = unproject(x, y, 12)
    expect(back.lat).toBeCloseTo(london.lat, 6)
    expect(back.lng).toBeCloseTo(london.lng, 6)
  })

  it('picks a zoom where the distance fits', () => {
    const zoom = zoomFor(51.5, 241_000, 140)
    expect(241_000 / metresPerPixel(51.5, zoom)).toBeLessThanOrEqual(140)
    expect(241_000 / metresPerPixel(51.5, zoom + 1)).toBeGreaterThan(140)
  })
})
