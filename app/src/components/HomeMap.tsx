import type { Spot } from '../lib/cities'

const TILE = 256
const TILES = 'https://tile.openstreetmap.org'

/** A small map of the member's home town with how far they'll go drawn on
 *  it (Lewis, 11 Oct, like Hinge). Only the town is shown, never an exact spot. */
export function HomeMap({ spot, km }: { spot: Spot; km: number | null }) {
  const radiusPx = 70
  const metres = km === null ? null : Math.max(km, 5) * 1000
  // Zoom so the circle is about radiusPx across; "any distance" shows the wider region.
  const perPixelAtZero = 156543.03 * Math.cos((spot.lat * Math.PI) / 180)
  const zoom = metres === null ? 5 : Math.max(3, Math.min(12, Math.floor(Math.log2((perPixelAtZero * radiusPx) / metres))))
  const circle = metres === null ? null : metres / (perPixelAtZero / 2 ** zoom)
  const world = TILE * 2 ** zoom
  const x = ((spot.lng + 180) / 360) * world
  const sin = Math.sin((spot.lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world
  const tiles: { tx: number; ty: number }[] = []
  for (let tx = Math.floor((x - 360) / TILE); tx <= Math.floor((x + 360) / TILE); tx++) {
    for (let ty = Math.floor((y - 110) / TILE); ty <= Math.floor((y + 110) / TILE); ty++) {
      if (ty >= 0 && ty < 2 ** zoom) tiles.push({ tx, ty })
    }
  }
  const wrap = (tx: number) => ((tx % 2 ** zoom) + 2 ** zoom) % 2 ** zoom
  return (
    <figure className="home-map" aria-label={`Map around ${spot.name}`}>
      <div className="home-map-tiles" aria-hidden="true">
        {tiles.map(({ tx, ty }) => (
          <img
            key={`${tx}-${ty}`}
            src={`${TILES}/${zoom}/${wrap(tx)}/${ty}.png`}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ left: `calc(50% + ${Math.round(tx * TILE - x)}px)`, top: `calc(50% + ${Math.round(ty * TILE - y)}px)` }}
          />
        ))}
        {circle !== null && <span className="home-map-circle" style={{ width: circle * 2, height: circle * 2 }} />}
        <span className="home-map-pin" />
      </div>
      <figcaption>
        {spot.name}
        <small>© OpenStreetMap</small>
      </figcaption>
    </figure>
  )
}
